const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { createStore } = require('zustand/vanilla');
const { SQLiteConnection } = require('./support/sqlite.cjs');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return resolveFilename.call(this, request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request, ...rest);
};

const { createDrivingModeService, monitoringEnabled } = require('../src/features/driving/utils/drivingModeService.ts');
const { bindMonitoring } = require('../src/features/driving/utils/bindMonitoring.ts');
const {
  homeLocationPresentation, homeMonitoringStatus, homeRiskPresentation,
} = require('../src/features/home/utils/homePresentation.ts');
const { createAreaService, areaCell, areaLabel } = require('../src/features/location/utils/areaService.ts');
const { areaPolicy } = require('../src/features/location/utils/areaPolicy.ts');
const { AreaRepository } = require('../src/common/lib/database/repositories/areaRepository.ts');
const { LocalDatabase } = require('../src/common/lib/database/localDatabase.ts');
const { migrateDatabase } = require('../src/common/lib/database/migrations/index.ts');
const { createRoadService } = require('../src/features/roads/utils/roadService.ts');
const { createCrashDetectionService } = require('../src/features/crash-detection/utils/crashDetectionService.ts');
const { createCheckInService } = require('../src/features/safety/utils/checkInService.ts');
const locales = ['en', 'fr', 'ar'].map((language) => require(`../src/common/lib/i18n/locales/${language}.json`));

const at = Date.parse('2026-10-31T10:00:00Z');
const flush = () => new Promise(setImmediate);
const deferred = () => { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const fix = (timestamp = at, latitude = 36.75) => ({ timestamp, latitude, longitude: 3.06, accuracy: 5, heading: 90, speedMs: 10, speedKmh: 36 });
const state = (overrides = {}) => ({ status: 'watching', location: 'granted', canAskAgain: true, motion: 'granted', requesting: false,
  fix: fix(), drivingState: 'driving', error: null, ...overrides });
const home = (overrides) => homeLocationPresentation(state(overrides), at);
const sources = { roads: true, weather: true, incidents: true };
const segmentRisk = (level, score, ids = ['roadClass']) => ({
  segmentId: 'way-1', level, score, factors: ids.map((id) => ({ id, contribution: 0.1 })),
});
const roadRisk = (overrides = {}) => ({ loading: false, current: segmentRisk('medium', 0.42), sources, ...overrides });
const translated = (key) => locales.every((locale) => typeof key.split('.').reduce((node, part) => node?.[part], locale) === 'string');
const preference = (initial = null) => {
  let value = initial;
  return { getItem: async () => value, setItem: async (_key, next) => { value = next; } };
};

test('automatic monitoring waits for preference restore, then follows the saved override', async (t) => {
  const pending = deferred();
  const mode = createDrivingModeService({ getItem: () => pending.promise, setItem: async () => {} });
  t.after(() => mode.stop());
  let starts = 0;
  const unbind = bindMonitoring(mode.store, { start: () => { starts++; }, stop: () => {} });
  t.after(unbind);
  const restoring = mode.start();
  assert.equal(monitoringEnabled(mode.store.getState()), false);
  assert.equal(starts, 0);
  pending.resolve(null); await restoring;
  assert.equal(starts, 1);
  await mode.setPaused(true);
  assert.equal(monitoringEnabled(mode.store.getState()), false);
});

test('pause is immediate, resume waits for persistence, and the preference survives a new session', async (t) => {
  const storage = preference();
  const mode = createDrivingModeService(storage); t.after(() => mode.stop());
  await mode.start();
  let gate = deferred();
  const write = storage.setItem;
  storage.setItem = async (...args) => { await gate.promise; await write(...args); };
  const pausing = mode.setPaused(true);
  assert.equal(mode.store.getState().paused, true);
  assert.equal(mode.store.getState().saving, true);
  await mode.setPaused(false); // A second press cannot race an in-flight change.
  assert.equal(mode.store.getState().paused, true);
  gate.resolve(); await pausing;
  const reopened = createDrivingModeService(storage); t.after(() => reopened.stop());
  await reopened.start(); assert.equal(reopened.store.getState().paused, true);
  gate = deferred();
  const resuming = mode.setPaused(false);
  assert.equal(mode.store.getState().paused, true);
  gate.resolve(); await resuming;
  assert.equal(mode.store.getState().paused, false);
});

test('unavailable or corrupt preference storage fails closed and can recover on explicit resume', async (t) => {
  for (const saved of ['bad-value', new Error('read failed')]) {
    const mode = createDrivingModeService({
      getItem: async () => { if (saved instanceof Error) throw saved; return saved; },
      setItem: async () => {},
    });
    t.after(() => mode.stop()); await mode.start();
    assert.equal(mode.store.getState().error, true);
    assert.equal(monitoringEnabled(mode.store.getState()), false);
    await mode.setPaused(false);
    assert.equal(monitoringEnabled(mode.store.getState()), true);
  }
  const mode = createDrivingModeService({ getItem: async () => null, setItem: async () => { throw new Error('write failed'); } });
  t.after(() => mode.stop()); await mode.start(); await mode.setPaused(true);
  assert.equal(mode.store.getState().paused, true);
  assert.equal(mode.store.getState().error, true);
  assert.equal(mode.store.getState().saving, false);
});

test('StrictMode restart ignores old restore completions and does not repeat storage reads', async (t) => {
  const pending = deferred(); let reads = 0;
  const mode = createDrivingModeService({ getItem: () => { reads++; return pending.promise; }, setItem: async () => {} });
  t.after(() => mode.stop());
  const first = mode.start(); mode.stop(); const second = mode.start();
  pending.resolve('1'); await Promise.all([first, second]);
  assert.equal(reads, 1); assert.equal(mode.store.getState().paused, true);
});

test('a lifecycle restart during a preference write waits for its result and leaves controls usable', async (t) => {
  const pending = deferred();
  const mode = createDrivingModeService({ getItem: async () => null, setItem: () => pending.promise });
  t.after(() => mode.stop());
  await mode.start();
  const pausing = mode.setPaused(true);
  mode.stop(); const restarted = mode.start();
  pending.resolve(); await Promise.all([pausing, restarted]);
  assert.equal(mode.store.getState().paused, true);
  assert.equal(mode.store.getState().saving, false);
  await mode.setPaused(false);
  assert.equal(monitoringEnabled(mode.store.getState()), true);
});

test('pausing stops road and crash services while position updates and an active emergency continue', async (t) => {
  const location = createStore(() => state());
  const mode = createDrivingModeService(preference()); t.after(() => mode.stop());
  let roadCalls = 0; let removals = 0;
  const road = createRoadService({ nearest: async () => {
    roadCalls++; return { waypoints: [{ name: 'Current road', nodes: [1, 2] }] };
  }, match: async () => { throw new Error('not needed'); } }, location, () => at);
  const crash = createCrashDetectionService({ available: async () => true,
    subscribe: async () => ({ remove: () => { removals++; } }) }, location, () => at);
  const unbindRoad = bindMonitoring(mode.store, road); t.after(unbindRoad);
  const unbindCrash = bindMonitoring(mode.store, crash); t.after(unbindCrash);
  await mode.start(); await flush(); await flush();
  assert.equal(roadCalls, 1); assert.equal(crash.store.getState().status, 'monitoring');
  const escalations = [];
  let time = at;
  const emergency = createCheckInService({ escalate: (trigger) => escalations.push(trigger), remind: () => {}, now: () => time });
  t.after(() => emergency.confirmOk()); emergency.begin();
  await mode.setPaused(true);
  assert.equal(removals, 1); assert.equal(road.store.getState().stale, true);
  location.setState({ fix: fix(at + 60_000, 36.9) }); await flush();
  assert.equal(roadCalls, 1); assert.equal(location.getState().fix.latitude, 36.9);
  assert.equal(emergency.store.getState().status, 'waiting');
  time += 181_000; emergency.sync();
  assert.deepEqual(escalations, ['check_in_timeout']);
  await mode.setPaused(false); await flush();
  assert.equal(crash.store.getState().status, 'monitoring');
});

test('speed distinguishes real zero from unknown, denied, old and stopped readings', () => {
  assert.equal(homeLocationPresentation(state({ fix: { ...fix(), speedKmh: 0 } }), at).speedKmh, 0);
  assert.equal(homeLocationPresentation(state({ fix: { ...fix(), speedKmh: null } }), at).speedKmh, null);
  for (const value of [state({ status: 'idle' }), state({ location: 'denied' }), state({ fix: fix(at - 31_000) })]) {
    assert.equal(homeLocationPresentation(value, at).speedKmh, null);
  }
  assert.equal(homeLocationPresentation(state({ fix: null }), at).loading, true);
  assert.equal(homeMonitoringStatus({ ready: true, paused: true }, state(), 'monitoring', at), 'paused');
  assert.equal(homeMonitoringStatus({ ready: true, paused: false }, state(), 'unavailable', at), 'limited');
  assert.equal(homeMonitoringStatus({ ready: true, paused: false }, state(), 'monitoring', at), 'monitoring');
});

test('live risk shows the level, a score out of 100, and translated top factors', () => {
  for (const [level, score, shown] of [['low', 0.08, 8], ['low', 0.29, 29], ['medium', 0.42, 42], ['high', 1, 100]]) {
    const risk = homeRiskPresentation(home(), roadRisk({ current: segmentRisk(level, score) }));
    assert.deepEqual(risk, { status: 'live', level, score: shown, factors: ['roadRisk.factor.roadClass'], notes: [] });
    assert.ok(translated(`dashboard.risk.${level}`), level);
  }
  const ids = ['roadClass', 'curves', 'junctions', 'wet', 'icing', 'visibility', 'wind', 'darkness', 'speeding',
    'incidents', 'tooFast', 'harshDriving'];
  const { factors } = homeRiskPresentation(home(), roadRisk({ current: segmentRisk('high', 0.9, ids) }));
  assert.deepEqual(factors, ids.map((id) => `roadRisk.factor.${id}`));
  for (const key of factors) assert.ok(translated(key), key);
});

test('the risk card waits for GPS and road data, and says when the road cannot be assessed', () => {
  assert.deepEqual(homeRiskPresentation(home({ location: 'denied' }), roadRisk()), { status: 'permission' });
  assert.deepEqual(homeRiskPresentation(home({ fix: null }), roadRisk({ current: null })), { status: 'loading' });
  assert.deepEqual(homeRiskPresentation(home(), roadRisk({ loading: true, current: null })), { status: 'loading' });
  const none = { roads: false, weather: false, incidents: false };
  assert.deepEqual(homeRiskPresentation(home({ fix: null, status: 'error' }), roadRisk({ current: null, sources: none })),
    { status: 'unassessed', notes: [] });
  assert.deepEqual(homeRiskPresentation(home(), roadRisk({ current: null })), { status: 'unassessed', notes: [] });
  assert.deepEqual(homeRiskPresentation(home(), roadRisk({ current: null, sources: { ...sources, roads: false } })),
    { status: 'unassessed', notes: ['roadRisk.failed'] });
});

test('an old position or missing weather and accident data is noted beside the score', () => {
  const risk = homeRiskPresentation(home({ fix: fix(at - 31_000) }),
    roadRisk({ sources: { roads: true, weather: false, incidents: false } }));
  assert.equal(risk.status, 'stale');
  assert.equal(risk.score, 42);
  assert.deepEqual(risk.notes, ['dashboard.location.stale', 'roadRisk.noWeather', 'roadRisk.noIncidents']);
  for (const key of [...risk.notes, 'roadRisk.failed']) assert.ok(translated(key), key);
});

test('locality lookup is shared per cell, cached, and throttled across movements', async (t) => {
  let now = at; let calls = 0; let reads = 0;
  const location = createStore(() => state());
  const saved = new Map();
  const service = createAreaService(location, {
    read: async (key) => { reads++; return saved.get(key) ?? null; },
    save: async (area) => { saved.set(area.key, area); },
  }, async () => { calls++; return { district: 'Hydra', city: 'Alger', region: 'Alger' }; }, () => now);
  t.after(() => service.stop()); service.setOnline(true); service.start(); await flush();
  assert.equal(service.store.getState().area.label, 'Hydra · Alger');
  for (let i = 0; i < 5; i++) location.setState({ fix: fix(now + i, 36.7501) });
  await flush(); assert.equal(calls, 1); assert.equal(reads, 1);
  location.setState({ fix: fix(now, 36.8) }); await flush();
  assert.equal(calls, 1, 'movement does not bypass the minimum lookup interval');
  now += areaPolicy.lookupIntervalMs;
  location.setState({ fix: fix(now, 36.8) }); await flush();
  assert.equal(calls, 2);
  assert.equal(service.store.getState().area.key, areaCell(36.8, 3.06).key);
});

test('offline locality cache is retained and a response from an old cell never becomes current', async (t) => {
  const location = createStore(() => state());
  const cached = { ...areaCell(36.75, 3.06), label: 'Saved locality', updatedAt: at - 1000 };
  let lookups = 0;
  const offline = createAreaService(location, { read: async () => cached, save: async () => {} },
    async () => { lookups++; return null; }, () => at);
  t.after(() => offline.stop()); offline.start(); await flush();
  assert.equal(lookups, 0); assert.equal(offline.store.getState().area.label, 'Saved locality');
  const pending = deferred();
  const service = createAreaService(location, { read: async () => null, save: async () => {} }, () => pending.promise, () => at);
  t.after(() => service.stop()); service.setOnline(true); service.start(); await flush();
  location.setState({ fix: fix(at, 37) });
  pending.resolve({ city: 'Old cell', district: null, region: null }); await flush();
  assert.equal(service.store.getState().area, null);
  service.stop(); assert.equal(service.store.getState().loading, false);
});

test('a cached locality becomes stale as time passes without connectivity', async (t) => {
  let now = at;
  const location = createStore(() => state());
  const cached = { ...areaCell(36.75, 3.06), label: 'Saved locality', updatedAt: at };
  const service = createAreaService(location, { read: async () => cached, save: async () => {} }, async () => null, () => now);
  t.after(() => service.stop()); service.start(); await flush();
  assert.equal(service.store.getState().stale, false);
  now += areaPolicy.freshMs + 1;
  location.setState({ fix: fix(now) });
  assert.equal(service.store.getState().stale, true);
  assert.equal(service.store.getState().area.label, 'Saved locality');
});

test('area cache persists through migration, validates payloads, and never adds sync operations', async (t) => {
  const connection = new SQLiteConnection(); t.after(() => connection.close());
  await migrateDatabase(connection);
  const repo = new AreaRepository(new LocalDatabase(async () => connection), () => at);
  const area = { ...areaCell(36.75, 3.06), label: 'Hydra', updatedAt: at };
  await repo.save(area); assert.deepEqual(await repo.read(area.key), area);
  await repo.save({ ...area, label: 'Older', updatedAt: at - 1000 });
  assert.equal((await repo.read(area.key)).label, 'Hydra');
  assert.equal((await connection.getFirstAsync('SELECT COUNT(*) AS n FROM sync_queue')).n, 0);
  await connection.runAsync('UPDATE location_areas SET payload = ?', '{bad');
  assert.equal(await repo.read(area.key), null);
  assert.equal(areaLabel(null), null);
});

function loadGlass(platform, native) {
  const filename = path.join(__dirname, '../src/common/lib/native/glass.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const instance = new Module(filename, module);
  instance.require = (name) => name === 'react-native'
    ? { Platform: { OS: platform }, AccessibilityInfo: { isReduceTransparencyEnabled: async () => true,
      addEventListener: () => ({ remove() {} }) } }
    : name === 'expo-glass-effect' ? native() : require(name);
  instance._compile(compiled.outputText, filename);
  return instance.exports;
}

test('glass requires both native guards and respects reduced transparency; unsupported builds do not load it', async () => {
  const unsupported = loadGlass('android', () => { throw new Error('must not load'); });
  assert.equal(unsupported.nativeGlassView(), null);
  const absent = loadGlass('ios', () => { throw new Error('missing native module'); });
  assert.equal(absent.nativeGlassView(), null);
  const unavailable = loadGlass('ios', () => ({ isGlassEffectAPIAvailable: () => false }));
  assert.equal(unavailable.nativeGlassView(), null);
  const view = () => null;
  const available = loadGlass('ios', () => ({ isGlassEffectAPIAvailable: () => true, isLiquidGlassAvailable: () => true, GlassView: view }));
  assert.equal(available.nativeGlassView(), view);
  let reduced;
  const stop = available.subscribeReducedTransparency((value) => { reduced = value; });
  await flush(); assert.equal(reduced, true); stop();
});
