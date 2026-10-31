const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const { create } = require('axios');
const { createStore } = require('zustand/vanilla');
const { SQLiteConnection } = require('./support/sqlite.cjs');

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request;
  return resolveFilename.call(this, mapped, ...rest);
};

const { ApiError } = require('../src/common/lib/api/apiError.ts');
const { createMockBackend } = require('../src/common/lib/api/mock/mockBackend.ts');
const { LocalDatabase } = require('../src/common/lib/database/localDatabase.ts');
const { migrateDatabase } = require('../src/common/lib/database/migrations/index.ts');
const { ProfileRepository } = require('../src/common/lib/database/repositories/profileRepository.ts');
const { TripRepository, TRIP_ENTITY } = require('../src/common/lib/database/repositories/tripRepository.ts');
const { createTripSyncAdapter } = require('../src/common/lib/database/sync/createTripSyncAdapter.ts');
const { SyncManager } = require('../src/common/lib/database/sync/syncManager.ts');
const { SyncQueue } = require('../src/common/lib/database/sync/syncQueue.ts');
const { createAlertService } = require('../src/features/alerts/utils/alertService.ts');
const { bindMonitoring } = require('../src/features/driving/utils/bindMonitoring.ts');
const { createDrivingModeService } = require('../src/features/driving/utils/drivingModeService.ts');
const { createTripRecorder } = require('../src/features/driving/utils/tripRecorder.ts');
const { createProfileApi } = require('../src/features/profile/api/profileApi.ts');
const { defaultSettings } = require('../src/features/settings/types/settings.types.ts');

const T0 = Date.parse('2026-10-31T08:00:00Z');
// Along a meridian, this many metres make one degree of latitude.
const METRES_PER_DEGREE = 6_371_000 * Math.PI / 180;
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1, `${actual} is not about ${expected}`);

async function fixture(t) {
  const connection = new SQLiteConnection();
  t.after(() => connection.close());
  await migrateDatabase(connection);
  const database = new LocalDatabase(async () => connection);
  const trips = new TripRepository(database, randomUUID, () => T0);
  const location = createStore(() => ({ status: 'watching', fix: null, drivingState: 'stationary' }));
  const account = { owner: 'alice' };
  let finished = 0;
  const recorder = () => createTripRecorder({
    location, trips, owner: () => account.owner, createId: randomUUID, onFinished: () => { finished += 1; },
  });
  // A fix `metres` north of the start, `seconds` after T0.
  const send = (metres, seconds, { drivingState = 'driving', ...fix } = {}) => location.setState({
    drivingState,
    fix: {
      latitude: 36.7 + metres / METRES_PER_DEGREE, longitude: 3.05, accuracy: 5, heading: null,
      speedMs: 15, speedKmh: 54, timestamp: T0 + seconds * 1000, ...fix,
    },
  });
  // Drives `count` fixes of 20 m, one a second, from where the last one left off.
  const drive = (from, at, count) => {
    for (let i = 1; i <= count; i++) send(from + 20 * i, at + i);
    return { metres: from + 20 * count, seconds: at + count };
  };
  const queued = async () => (await connection.getAllAsync('SELECT payload, status FROM sync_queue WHERE entity = ? ORDER BY sequence', TRIP_ENTITY))
    .map(({ payload, status }) => ({ ...JSON.parse(payload), status }));
  const open = () => connection.getAllAsync('SELECT * FROM trips');
  return { connection, database, trips, location, account, recorder, send, drive, queued, open, finished: () => finished };
}

test('a trip runs while driving and is queued with totals only', async (t) => {
  const f = await fixture(t);
  const recorder = f.recorder(); recorder.start();
  f.send(0, 0, { drivingState: 'stationary' });
  f.send(0, 1);
  const end = f.drive(0, 1, 59);
  f.send(end.metres, end.seconds + 1, { drivingState: 'stationary', speedMs: 0 });
  await settle();

  const [trip] = await f.queued();
  assert.deepEqual(Object.keys(trip).sort(), ['distanceMeters', 'endedAt', 'id', 'owner', 'startedAt', 'status', 'warnings']);
  near(trip.distanceMeters, 1180);
  assert.equal(trip.startedAt, new Date(T0 + 1000).toISOString());
  assert.equal(trip.endedAt, new Date(T0 + (end.seconds + 1) * 1000).toISOString());
  assert.equal(trip.owner, 'alice'); assert.equal(trip.warnings, 0);
  assert.equal(f.finished(), 1); assert.deepEqual(await f.open(), []);
});

test('inaccurate fixes, jumps and a stopped car add no distance', async (t) => {
  const f = await fixture(t);
  const recorder = f.recorder(); recorder.start();
  f.send(0, 0); f.send(15, 1); f.send(30, 2);
  f.send(600, 3, { accuracy: 80 });
  f.send(2000, 4);
  f.send(45, 5); f.send(60, 6);
  f.send(63, 7, { speedMs: 0 }); f.send(58, 8, { speedMs: 0 });
  const end = f.drive(58, 8, 30);
  f.send(end.metres, end.seconds + 1, { drivingState: 'stationary', speedMs: 0 });
  await settle();

  const [trip] = await f.queued();
  near(trip.distanceMeters, 30 + 30 + 600);
});

test('a trip too short to be real is dropped', async (t) => {
  const f = await fixture(t);
  const recorder = f.recorder(); recorder.start();
  f.send(0, 0);
  const end = f.drive(0, 0, 20);
  f.send(end.metres, end.seconds + 1, { drivingState: 'stationary', speedMs: 0 });
  await settle();
  assert.deepEqual(await f.queued(), []); assert.deepEqual(await f.open(), []); assert.equal(f.finished(), 0);
});

test('warnings shown to the driver during a trip are counted, but not crashes, repeats or disabled alerts', async (t) => {
  const f = await fixture(t);
  const settings = structuredClone(defaultSettings); let now = T0;
  const alerts = createAlertService({
    driver: { present: async () => {}, playHaptic: async () => {} }, navigate() {}, sendPushToken: async () => {},
    getSettings: () => settings, now: () => now,
  });
  t.after(() => alerts.dismissBanner());
  const recorder = f.recorder();
  alerts.onWarning(() => recorder.countWarning());
  const text = { title: '', body: '' };
  alerts.raise({ id: 'before', type: 'potential_accident' }, text);

  recorder.start();
  f.send(0, 0);
  let at = f.drive(0, 0, 10);
  now += 60_000; alerts.raise({ id: 'risk', type: 'potential_accident', detail: 'sharp_bend' }, text);
  alerts.raise({ id: 'risk', type: 'potential_accident', detail: 'sharp_bend' }, text);
  now += 60_000; alerts.raise({ id: 'nearby', type: 'accident_nearby', distanceMeters: 800 }, text);
  now += 60_000; alerts.raise({ id: 'crash', type: 'crash_detected' }, text);
  settings.notifications.accident_nearby = false;
  now += 60_000; alerts.raise({ id: 'muted', type: 'accident_nearby', distanceMeters: 100 }, text);
  at = f.drive(at.metres, at.seconds, 30);
  f.send(at.metres, at.seconds + 1, { drivingState: 'stationary', speedMs: 0 });
  await settle();

  const [trip] = await f.queued();
  assert.equal(trip.warnings, 2);
});

test('signing out drops the trip under way and discards that account’s trips only', async (t) => {
  const f = await fixture(t);
  const recorder = f.recorder(); recorder.start();
  f.send(0, 0);
  const at = f.drive(0, 0, 40);
  await settle();
  const [saved] = await f.open();
  f.account.owner = null;
  f.send(at.metres + 20, at.seconds + 1);
  recorder.countWarning();
  f.send(at.metres + 20, at.seconds + 2, { drivingState: 'stationary', speedMs: 0 });
  await settle();
  // Nothing more is recorded for the account; Log out then discards what it saved.
  assert.deepEqual(await f.queued(), []); assert.deepEqual(await f.open(), [saved]);

  const trip = (owner) => ({ id: randomUUID(), owner, startedAt: T0, endedAt: T0 + 600_000, distanceMeters: 5000, warnings: 1 });
  await f.trips.finish(trip('alice'), true); await f.trips.finish(trip('bob'), true);
  await f.trips.saveOpen(trip('bob'));
  await f.trips.discard('alice');
  assert.deepEqual((await f.queued()).map(({ owner }) => owner), ['bob']);
  assert.deepEqual((await f.open()).map(({ owner }) => owner), ['bob']);
});

test('another account signing in mid-drive starts its own trip', async (t) => {
  const f = await fixture(t);
  const recorder = f.recorder(); recorder.start();
  f.send(0, 0);
  let at = f.drive(0, 0, 40);
  f.account.owner = 'bob';
  f.send(at.metres + 20, at.seconds + 1);
  at = f.drive(at.metres + 20, at.seconds + 1, 30);
  f.send(at.metres, at.seconds + 1, { drivingState: 'stationary', speedMs: 0 });
  await settle();
  const trips = await f.queued();
  assert.deepEqual(trips.map(({ owner }) => owner), ['bob']);
  near(trips[0].distanceMeters, 600);
});

test('a long gap without fixes ends the trip at its last fix', async (t) => {
  const f = await fixture(t);
  const recorder = f.recorder(); recorder.start();
  f.send(0, 0);
  const at = f.drive(0, 0, 40);
  f.send(at.metres + 9000, at.seconds + 6 * 60);
  await settle();
  const [trip] = await f.queued();
  assert.equal(trip.endedAt, new Date(T0 + at.seconds * 1000).toISOString());
  near(trip.distanceMeters, 800);
});

test('pausing monitoring ends the trip and stops recording', async (t) => {
  const f = await fixture(t);
  const mode = createDrivingModeService({ getItem: async () => '0', setItem: async () => {} });
  await mode.start();
  const recorder = f.recorder();
  const unbind = bindMonitoring(mode.store, recorder);
  t.after(unbind);
  f.send(0, 0);
  const at = f.drive(0, 0, 40);
  await mode.setPaused(true);
  f.drive(at.metres, at.seconds, 40);
  await settle();
  const trips = await f.queued();
  assert.equal(trips.length, 1); near(trips[0].distanceMeters, 800);
  assert.deepEqual(await f.open(), []);
});

test('a trip under way survives a restart and is ended at its last saved fix', async (t) => {
  const f = await fixture(t);
  const before = f.recorder(); before.start();
  f.send(0, 0);
  f.drive(0, 0, 40);
  await settle();
  assert.equal((await f.open()).length, 1);

  // The app was killed: nothing ended the trip, and a new launch recovers it once.
  const after = f.recorder();
  await Promise.all([after.recover(), after.recover()]);
  const trips = await f.queued();
  assert.equal(trips.length, 1);
  near(trips[0].distanceMeters, 600);
  assert.equal(trips[0].endedAt, new Date(T0 + 30_000).toISOString());
  assert.deepEqual(await f.open(), []);
});

test('the sync queue uploads a trip for its owner, counts it as waiting until then, and keeps a refused one out of the totals', async (t) => {
  const f = await fixture(t);
  const sent = []; let response = async () => {};
  const queue = new SyncQueue(f.database);
  const state = { online: false, time: T0 };
  const sync = new SyncManager(queue, {
    canSync: () => state.online, onChange: async () => {}, onRunning: () => {}, onError: () => {}, onSuccess: () => {},
    now: () => state.time, random: () => 0.5,
  });
  sync.register(TRIP_ENTITY, createTripSyncAdapter({ recordTrip: async (trip, owner) => { sent.push({ trip, owner }); await response(); } }));
  const trip = (owner, distanceMeters, warnings) => ({ id: randomUUID(), owner, startedAt: T0, endedAt: T0 + 600_000, distanceMeters, warnings });
  await f.trips.finish(trip('alice', 1200.4, 2), true); await f.trips.finish(trip('bob', 900, 1), true);

  assert.deepEqual(await f.trips.waiting('alice'), { trips: 1, distanceMeters: 1200, warnings: 2 });
  state.online = true;
  response = async () => { throw new ApiError('network', 'Could not reach the server.'); };
  await sync.requestSync();
  assert.deepEqual(await f.trips.waiting('alice'), { trips: 1, distanceMeters: 1200, warnings: 2 });

  response = async () => {};
  state.time += 60 * 60_000;
  await sync.requestSync();
  assert.deepEqual(sent.at(-2).trip, { id: sent.at(-2).trip.id, startedAt: new Date(T0).toISOString(), endedAt: new Date(T0 + 600_000).toISOString(), distanceMeters: 1200, warnings: 2 });
  assert.deepEqual(sent.slice(-2).map(({ owner }) => owner), ['alice', 'bob']);
  assert.deepEqual(await f.trips.waiting('alice'), { trips: 0, distanceMeters: 0, warnings: 0 });

  response = async () => { throw new ApiError('validation', 'Bad trip.', 422); };
  await f.trips.finish(trip('alice', 700, 0), true);
  await sync.requestSync();
  assert.equal((await queue.summary()).conflicts, 1);
  assert.deepEqual(await f.trips.waiting('alice'), { trips: 0, distanceMeters: 0, warnings: 0 });

  await f.trips.clearDelivered();
  assert.deepEqual((await f.queued()).map(({ status }) => status), ['conflict']);
});

test('erasing personal data clears the account’s trips', async (t) => {
  const f = await fixture(t);
  const trip = { id: randomUUID(), owner: 'alice', startedAt: T0, endedAt: T0 + 600_000, distanceMeters: 5000, warnings: 0 };
  await f.trips.finish(trip, true); await f.trips.saveOpen({ ...trip, id: randomUUID() });
  await new ProfileRepository(f.database).purgePersonalData('alice');
  assert.deepEqual(await f.queued(), []); assert.deepEqual(await f.open(), []);
});

test('the mock records each trip once and returns real totals', async () => {
  let value = null;
  const client = create({ adapter: createMockBackend({ getItem: () => value, setItem: (_key, next) => { value = next; } }, 0),
    headers: { Authorization: 'Bearer mock-access.mock-demo' } });
  const api = createProfileApi(client);
  const trip = { id: randomUUID(), startedAt: new Date(T0).toISOString(), endedAt: new Date(T0 + 600_000).toISOString(), distanceMeters: 1200, warnings: 2 };
  assert.deepEqual(await api.getDrivingStats(), { trips: 0, distanceMeters: 0, warnings: 0 });
  await api.recordTrip(trip, 'mock-demo'); await api.recordTrip(trip, 'mock-demo');
  await api.recordTrip({ ...trip, id: randomUUID(), distanceMeters: 800, warnings: 0 }, 'mock-demo');
  assert.deepEqual(await api.getDrivingStats(), { trips: 2, distanceMeters: 2000, warnings: 2 });
  await assert.rejects(api.recordTrip({ ...trip, id: randomUUID() }, 'mock-taken'));
  await api.deleteData();
  assert.deepEqual(await api.getDrivingStats(), { trips: 0, distanceMeters: 0, warnings: 0 });
});
