const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const { create, AxiosError } = require('axios');
const fs = require('node:fs');
const { SQLiteConnection } = require('./support/sqlite.cjs');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request, ...args);
};
const { LocalDatabase } = require('../src/common/lib/database/localDatabase.ts');
const { migrateDatabase } = require('../src/common/lib/database/migrations/index.ts');
const { ProfileRepository } = require('../src/common/lib/database/repositories/profileRepository.ts');
const { createProfileService, profileForAccount } = require('../src/features/profile/utils/profileService.ts');
const { profileBundleSchema } = require('../src/features/profile/types/profile.schemas.ts');
const { createSettingsService } = require('../src/features/settings/utils/settingsService.ts');
const { defaultSettings } = require('../src/features/settings/types/settings.types.ts');
const { createAuthSession } = require('../src/common/lib/api/authSession.ts');
const { createCheckInService } = require('../src/features/safety/utils/checkInService.ts');
const { createAlertService } = require('../src/features/alerts/utils/alertService.ts');
const { createCrashDetector } = require('../src/features/crash-detection/utils/crash.utils.ts');
const { sensitivityPolicy } = require('../src/features/crash-detection/utils/sensitivity.ts');
const { createProfileApi } = require('../src/features/profile/api/profileApi.ts');
const { createMockBackend } = require('../src/common/lib/api/mock/mockBackend.ts');
const { speedValue, distanceValue } = require('../src/features/settings/utils/units.ts');
const { installAuthInterceptors } = require('../src/common/lib/api/authInterceptors.ts');
const { createCrashModelMonitor } = require('../src/features/crash-detection/model/crashModelMonitor.ts');

const flush = () => new Promise(setImmediate);
const gate = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const storage = () => { const values = new Map(); return { values, getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => { values.set(key, value); }, removeItem: async (key) => { values.delete(key); } }; };
const bundle = (id = 'alice') => profileBundleSchema.parse({ profile: { id, firstName: 'Alice', lastName: 'Driver',
  email: `${id}@example.test`, mobileNumber: '+213555000001', onboardingStatus: 'complete' }, contacts: [], stats: null, reports: [] });
async function database(t) {
  const connection = new SQLiteConnection(); t.after(() => connection.close()); await migrateDatabase(connection);
  return { connection, repository: new ProfileRepository(new LocalDatabase(async () => connection)) };
}
const transport = (initial = bundle()) => {
  let remote = structuredClone(initial);
  const api = {
    getProfile: async () => structuredClone(remote.profile), getEmergencyContacts: async () => ({ contacts: structuredClone(remote.contacts) }),
    getDrivingStats: async () => ({ trips: 2, distanceMeters: 2400, warnings: 1 }), getReports: async () => ({ reports: [] }),
    updateProfile: async (patch) => { remote.profile = { ...remote.profile, ...patch }; return remote.profile; },
    replaceEmergencyContacts: async (contacts) => { remote.contacts = contacts; return { contacts }; },
    deleteAccount: async () => {}, deleteData: async () => {},
    uploadPhoto: async () => ({ photoUrl: 'https://example.test/avatar.jpg' }),
  };
  return { api, remote: () => remote };
};

test('settings persist, concurrent toggles merge, and failed writes do not pretend to succeed', async () => {
  const memory = storage(); const service = createSettingsService(memory); await service.start();
  await Promise.all([service.update({ notifications: { accident_nearby: false } }), service.update({ notifications: { potential_accident: false } })]);
  await service.update({ units: 'mph', countdownSeconds: 60 });
  const reopened = createSettingsService(memory); await reopened.start();
  assert.equal(reopened.store.getState().settings.units, 'mph');
  assert.equal(reopened.store.getState().settings.notifications.accident_nearby, false);
  assert.equal(reopened.store.getState().settings.notifications.potential_accident, false);
  memory.setItem = async () => { throw new Error('disk full'); };
  await assert.rejects(service.update({ units: 'kmh' }));
  assert.equal(service.store.getState().settings.units, 'mph');
  assert.equal(service.store.getState().error, true);
});

test('privacy consent belongs to one account and survives that account restarting', async () => {
  const memory = storage(); const service = createSettingsService(memory);
  await service.start(); await service.setAccount('alice');
  await service.update({ dataSharing: true, shareMedicalInfo: true });
  const reopened = createSettingsService(memory); await reopened.start(); await reopened.setAccount('alice');
  assert.equal(reopened.store.getState().settings.shareMedicalInfo, true);
  await reopened.setAccount('bob');
  assert.equal(reopened.store.getState().settings.dataSharing, false);
  assert.equal(reopened.store.getState().settings.shareMedicalInfo, false);
  assert.equal(reopened.store.getState().consentOwner, 'bob');
});

test('an unreadable settings file leaves automatic detection paused', async () => {
  const service = createSettingsService({ getItem: async () => '{bad', setItem: async () => {} });
  await service.start(); assert.equal(service.store.getState().error, true);
  assert.equal(service.store.getState().settings.crashDetection, false);
  await service.update({ crashDetection: true }); assert.equal(service.store.getState().settings.crashDetection, true);
});

test('offline profile edits are durable, account-scoped and never replaced by a stale fetch', async (t) => {
  const { repository } = await database(t);
  const original = bundle(); await repository.write(original, false);
  const edited = structuredClone(original); edited.profile.firstName = 'Edited'; edited.profile.medical.allergies = 'Penicillin';
  edited.contacts = [{ id: randomUUID(), name: 'Family', mobileNumber: '+213555000002', relationship: 'Sibling' }];
  const local = await repository.write(edited, true);
  await repository.write(original, false);
  assert.equal((await repository.read('alice')).bundle.profile.firstName, 'Edited');
  assert.equal(await repository.read('bob'), null);
  const service = createProfileService(repository, transport().api); await service.connect('alice');
  assert.equal((await service.read()).dirty, true);
  assert.equal((await service.read()).bundle.profile.medical.allergies, 'Penicillin');
  await repository.acknowledge('alice', local.revision - 1);
  assert.equal((await repository.read('alice')).dirty, true);
});

test('reconnecting sends pending profile and contacts, then acknowledges the exact local revision', async (t) => {
  const { repository } = await database(t); const initial = bundle();
  await repository.write(initial, false); const backend = transport(initial);
  const service = createProfileService(repository, backend.api); await service.connect('alice');
  const changed = structuredClone(initial); changed.profile.vehicle = 'Clio'; changed.profile.medical.bloodType = 'O+';
  await service.save(changed); assert.equal((await service.read()).dirty, true);
  service.setOnline(true); await flush(); await flush();
  assert.equal(backend.remote().profile.vehicle, 'Clio');
  assert.equal(backend.remote().profile.medical.bloodType, 'O+');
  assert.equal((await repository.read('alice')).dirty, false);
  assert.equal((await service.read()).bundle.stats.trips, 2);
});

test('an edit made during upload stays pending and is eventually sent', async (t) => {
  const { repository } = await database(t); const initial = bundle(); await repository.write(initial, false);
  const backend = transport(initial); const pending = gate(); let calls = 0;
  const update = backend.api.updateProfile;
  backend.api.updateProfile = async (patch) => { if (++calls === 1) await pending.promise; return update(patch); };
  const service = createProfileService(repository, backend.api); await service.connect('alice');
  await service.save({ ...initial, profile: { ...initial.profile, firstName: 'First' } });
  service.setOnline(true); await flush();
  await service.save({ ...initial, profile: { ...initial.profile, firstName: 'Latest' } });
  pending.resolve(); await flush(); await flush(); await flush();
  assert.equal(backend.remote().profile.firstName, 'Latest');
  assert.equal((await repository.read('alice')).dirty, false);
});

test('switching accounts ignores an old response and never sends its contacts as the next user', async (t) => {
  const { repository } = await database(t); const initial = bundle(); await repository.write(initial, true);
  const other = bundle('bob'); await repository.write(other, false);
  const backend = transport(initial); const pending = gate(); let contactWrites = 0;
  backend.api.updateProfile = async () => { await pending.promise; return initial.profile; };
  backend.api.replaceEmergencyContacts = async () => { contactWrites++; return { contacts: [] }; };
  const service = createProfileService(repository, backend.api); await service.connect('alice');
  service.setOnline(true); await flush(); service.setOnline(false); await service.connect('bob');
  pending.resolve(); await flush();
  assert.equal(contactWrites, 0); assert.equal((await service.read()).bundle.profile.id, 'bob');
  assert.equal((await repository.read('alice')).dirty, true);
});

test('a server failure retains unsent edits and never deletes local data', async (t) => {
  const { repository } = await database(t); await repository.write(bundle(), true);
  const backend = transport(); backend.api.updateProfile = async () => { throw new Error('offline'); };
  backend.api.deleteAccount = async () => { throw new Error('server down'); };
  const service = createProfileService(repository, backend.api); await service.connect('alice'); service.setOnline(true);
  await flush(); await flush(); assert.equal((await repository.read('alice')).dirty, true);
  await assert.rejects(service.erase(true)); assert.ok(await repository.read('alice'));
});

test('data erasure clears pending device data and only the selected account profile', async (t) => {
  const { repository, connection } = await database(t); await repository.write(bundle(), true); await repository.write(bundle('bob'), false);
  await connection.runAsync('INSERT INTO sync_metadata(entity,cursor,updated_at) VALUES(?,?,?)', 'todo', 'cursor', new Date().toISOString());
  await repository.purgePersonalData('alice');
  assert.equal(await repository.read('alice'), null); assert.ok(await repository.read('bob'));
  assert.equal((await connection.getFirstAsync('SELECT COUNT(*) AS n FROM sync_metadata')).n, 0);
});

test('sign-out during a slow sign-in cannot restore the old identity or its tokens', async () => {
  const memory = storage(); const pending = gate(); const set = memory.setItem; let first = true;
  memory.setItem = async (...args) => { if (first) { first = false; await pending.promise; } await set(...args); };
  const session = createAuthSession(memory); const signIn = session.save({ accessToken: 'a', refreshToken: 'r' }, 'alice');
  await flush(); const signOut = session.clear(); pending.resolve(); await Promise.all([signIn, signOut]);
  assert.equal(session.getTokens(), null); assert.equal(session.status.getState().userId, null);
  const reopened = createAuthSession(memory); await reopened.restore(); assert.equal(reopened.status.getState().status, 'signedOut');
});

test('check-in countdown uses the saved total and freezes it during the emergency', () => {
  let now = 1000; let total = 60; let escalations = 0;
  const service = createCheckInService({ now: () => now, getCountdownSeconds: () => total, remind() {}, escalate: () => { escalations++; } });
  try {
    service.begin(); assert.equal(service.roundDuration(), 10); total = 180;
    now += 60_000; service.sync(); assert.equal(escalations, 1);
    service.confirmOk(); service.begin(); assert.equal(service.roundDuration(), 30);
  } finally { service.confirmOk(); }
});

test('alert toggles and radius suppress delivery and voice without blocking an emergency screen', () => {
  let settings = structuredClone(defaultSettings); const shown = []; const spoken = []; const navigated = [];
  const service = createAlertService({ driver: { present: async (alert) => { shown.push(alert); }, playHaptic: async () => {} },
    navigate: (alert) => navigated.push(alert), sendPushToken: async () => {}, getSettings: () => settings,
    speak: (alert) => spoken.push(alert), now: () => 1000 });
  settings.notifications.potential_accident = false;
  service.raise({ id: 'warning', type: 'potential_accident' }, { title: '', body: '' });
  service.raise({ id: 'far', type: 'accident_nearby', distanceMeters: 6000 }, { title: '', body: '' });
  settings.notifications.crash_detected = false;
  service.raise({ id: 'crash', type: 'crash_detected' }, { title: '', body: '' });
  assert.equal(shown.length, 0); assert.equal(spoken.length, 0); assert.equal(navigated.length, 1);
  settings.notifications.potential_accident = true;
  settings.voice = true;
  service.raise({ id: 'enabled', type: 'potential_accident' }, { title: '', body: '' });
  assert.equal(shown.length, 1); assert.equal(spoken.length, 1); service.dismissBanner();
});

test('sensitivity changes the actual impact gate, and units preserve SI source values', () => {
  const detect = (sensitivity) => {
    const detector = createCrashDetector(() => sensitivityPolicy(sensitivity));
    detector.addFix({ latitude: 36, longitude: 3, timestamp: 0, speedKmh: 60 });
    detector.addAcceleration({ t: 1, x: 0, y: 0, z: 3.7 });
    detector.addFix({ latitude: 36, longitude: 3, timestamp: 1000, speedKmh: 0 });
    return detector.addAcceleration({ t: 4001, x: 0, y: 0, z: 1 });
  };
  assert.equal(detect('standard'), null); assert.ok(detect('high'));
  assert.equal(speedValue(160.9344, 'mph'), 100); assert.equal(distanceValue(1609.344, 'mph'), 1);
});

test('mock profile contract accepts edits, history and deletion with no real backend', async () => {
  let value = null; const client = create({ adapter: createMockBackend({ getItem: () => value, setItem: (_key, next) => { value = next; } }, 0),
    headers: { Authorization: 'Bearer mock-access.mock-demo' } });
  const api = createProfileApi(client); const original = await api.getProfile();
  await api.updateProfile({ ...original, firstName: 'Updated', vehicle: 'Car', medical: { bloodType: 'A+', allergies: '', conditions: '' } });
  assert.equal((await api.getProfile()).medical.bloodType, 'A+');
  await api.updatePreferences(defaultSettings); assert.deepEqual((await api.getReports()).reports, []);
  await api.deleteData(); assert.equal((await api.getProfile()).medical.bloodType, '');
  await api.deleteAccount(); await assert.rejects(api.getProfile());
});

test('offline medical, contacts and a queued photo survive closing and reopening the database', async (t) => {
  fs.mkdirSync(path.join(process.cwd(), '.expo'), { recursive: true });
  const folder = fs.mkdtempSync(path.join(process.cwd(), '.expo', 'profile-test-'));
  const file = path.join(folder, 'profile.db');
  let connection = new SQLiteConnection(file);
  t.after(() => {
    connection.close();
    for (const entry of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder, entry));
    fs.rmdirSync(folder);
  });
  await migrateDatabase(connection);
  const first = new ProfileRepository(new LocalDatabase(async () => connection));
  const value = bundle(); value.profile.medical.conditions = 'Asthma';
  value.pendingPhoto = `${'a'.repeat(64)}/${randomUUID()}.jpg`;
  await first.write(value, true); connection.close();
  connection = new SQLiteConnection(file); await migrateDatabase(connection);
  const second = new ProfileRepository(new LocalDatabase(async () => connection));
  const restored = await second.read('alice');
  assert.equal(restored.bundle.profile.medical.conditions, 'Asthma');
  assert.equal(restored.bundle.pendingPhoto, value.pendingPhoto); assert.equal(restored.dirty, true);
});

test('a server which ignores new medical fields cannot silently acknowledge an offline edit', async (t) => {
  const { repository } = await database(t); const initial = bundle(); const backend = transport(initial);
  await repository.write(initial, false); backend.api.updateProfile = async () => initial.profile;
  const service = createProfileService(repository, backend.api); await service.connect('alice');
  const edited = structuredClone(initial); edited.profile.medical.allergies = 'Penicillin'; await service.save(edited);
  service.setOnline(true); await flush(); await flush();
  assert.equal((await repository.read('alice')).dirty, true); assert.equal(service.store.getState().error, true);
});

test('an old account mutation is never retried with a newly signed-in user token', async () => {
  const memory = storage(); const session = createAuthSession(memory);
  await session.save({ accessToken: 'a', refreshToken: 'ra' }, 'alice');
  let requests = 0;
  const client = create({ adapter: async (config) => {
    requests++;
    await session.save({ accessToken: 'b', refreshToken: 'rb' }, 'bob');
    throw new AxiosError('unauthorized', 'ERR_BAD_REQUEST', config, null, { status: 401, data: {}, config });
  } });
  installAuthInterceptors(client, session, async () => { throw new Error('must not refresh the next account'); });
  const api = createProfileApi(client, () => session.status.getState().userId);
  await assert.rejects(api.updateProfile(bundle().profile));
  assert.equal(requests, 1); assert.equal(session.status.getState().userId, 'bob');
});

test('voice can be disabled without muting visual notifications', () => {
  const settings = structuredClone(defaultSettings); let speech = 0; let notifications = 0;
  const service = createAlertService({ driver: { present: async () => { notifications++; }, playHaptic: async () => {} },
    navigate() {}, sendPushToken: async () => {}, getSettings: () => settings, speak: () => { speech++; } });
  service.raise({ id: 'voice-off', type: 'potential_accident' }, { title: '', body: '' });
  assert.equal(notifications, 1); assert.equal(speech, 0); service.dismissBanner();
});

test('stopping detection discards a model result which finishes after shutdown', async () => {
  const pending = gate(); let detections = 0;
  const model = createCrashModelMonitor({ classify: () => pending.promise, onCrash: () => { detections++; }, onNearMiss() {} });
  model.addFix({ timestamp: 0, speedKmh: 60, latitude: 36, longitude: 3 });
  model.addAcceleration({ t: 1000, x: 5, y: 0, z: 1 });
  model.addAcceleration({ t: 10_000, x: 0, y: 0, z: 1 });
  model.reset(); pending.resolve({ crash: 1, nearMiss: 0, normal: 0 }); await flush();
  assert.equal(detections, 0);
});

test('an account switch hides the previous profile immediately, before provider effects run', () => {
  const state = { cache: { bundle: bundle(), revision: 1, dirty: false }, loading: false, syncing: false, error: false };
  assert.ok(profileForAccount(state, 'alice', true).cache);
  assert.equal(profileForAccount(state, 'bob', true).cache, null);
  assert.equal(profileForAccount(state, 'bob', true).loading, true);
  assert.equal(profileForAccount(state, null, false).cache, null);
});
