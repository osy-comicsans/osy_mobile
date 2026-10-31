const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { create } = require('axios');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request;
  return resolveFilename.call(this, mapped, ...rest);
};
const { createNearbyIncidents } = require('../src/features/safety/utils/nearbyIncidents.ts');
const { createMockBackend } = require('../src/common/lib/api/mock/mockBackend.ts');
const { createSafetyApi } = require('../src/features/safety/api/safetyApi.ts');
const { incidentFeatures, routeFeatures } = require('../src/features/map/utils/mapOverlays.ts');

const MINUTE = 60_000;
const START = Date.parse('2026-10-31T10:00:00Z');
// About 111 metres per 0.001 degree of latitude.
const fix = (latitudeOffset = 0) => ({
  latitude: 36.75 + latitudeOffset, longitude: 3.05, accuracy: 5, heading: 0, speedMs: 0, speedKmh: 0, timestamp: START,
});
const incident = (id, metresNorth, minutesAgo = 5, extra = {}) => ({
  id,
  source: 'user_report',
  location: { latitude: 36.75 + metresNorth / 111_000, longitude: 3.05 },
  occurredAt: new Date(START - minutesAgo * MINUTE).toISOString(),
  type: 'collision',
  severity: 'serious',
  injuriesVisible: true,
  roadName: 'RN 5',
  distanceMeters: null,
  ...extra,
});

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  };
}

function fixture({ incidents = [], preferences = { enabled: true, radiusKm: 5 }, storage = memoryStorage() } = {}) {
  let clock = START;
  const queries = [];
  const server = { incidents, fail: false };
  const service = createNearbyIncidents({
    fetchNearby: async (query) => {
      queries.push(query);
      if (server.fail) throw new Error('offline');
      return { incidents: server.incidents };
    },
    preferences: () => preferences,
    storage,
    now: () => clock,
  });
  return {
    service, queries, server, storage, preferences,
    advance: (ms) => { clock += ms; },
    shown: () => service.store.getState().incidents.map(({ id }) => id),
  };
}

test('alerts the closest new incident once and lists every one nearby', async () => {
  const f = fixture({ incidents: [incident('far', 3_000), incident('near', 800)] });
  const alert = await f.service.update(fix(), false);
  assert.equal(alert.id, 'near');
  assert.ok(Math.abs(alert.distanceMeters - 800) < 10);
  assert.deepEqual(f.shown(), ['near', 'far']);
  assert.deepEqual(f.queries[0], { latitude: 36.75, longitude: 3.05, radiusKm: 5 });

  f.advance(2 * MINUTE);
  assert.equal((await f.service.update(fix(), false)).id, 'far');
  f.advance(2 * MINUTE);
  assert.equal(await f.service.update(fix(), false), null);
});

test('never alerts about the user’s own report or crash', async () => {
  const f = fixture({ incidents: [incident('mine', 100), incident('crash', 200)] });
  await f.service.markOwn('mine');
  const alert = await f.service.update(fix(), false);
  assert.equal(alert.id, 'crash');
  await f.service.markOwn('crash');
  assert.deepEqual(f.shown(), []);
});

test('skips old incidents and ones outside the radius', async () => {
  const f = fixture({ incidents: [incident('old', 500, 3 * 60), incident('outside', 6_000)] });
  assert.equal(await f.service.update(fix(), false), null);
  assert.deepEqual(f.shown(), []);
});

test('waits while the driver is answering their own check-in', async () => {
  const f = fixture({ incidents: [incident('near', 800)] });
  assert.equal(await f.service.update(fix(), true), null);
  assert.deepEqual(f.shown(), ['near']);
  f.advance(2 * MINUTE);
  assert.equal((await f.service.update(fix(), false)).id, 'near');
});

test('checks again after a minute, or sooner after moving 500 m', async () => {
  const f = fixture();
  await f.service.update(fix(), false);
  f.advance(20_000);
  await f.service.update(fix(0.001), false);
  assert.equal(f.queries.length, 1);
  await f.service.update(fix(0.006), false);
  assert.equal(f.queries.length, 2);
  f.advance(61_000);
  await f.service.update(fix(0.006), false);
  assert.equal(f.queries.length, 3);
});

test('turned off, it checks nothing and clears the list', async () => {
  const f = fixture({ incidents: [incident('near', 800)] });
  await f.service.update(fix(), true);
  f.preferences.enabled = false;
  f.advance(2 * MINUTE);
  assert.equal(await f.service.update(fix(), false), null);
  assert.equal(f.queries.length, 1);
  assert.deepEqual(f.shown(), []);
});

test('uses the chosen radius', async () => {
  const f = fixture({ incidents: [incident('two-km', 2_000)], preferences: { enabled: true, radiusKm: 1 } });
  await f.service.update(fix(), false);
  assert.equal(f.queries[0].radiusKm, 1);
  assert.deepEqual(f.shown(), []);
});

test('the app checks only with nearby alerts on, within the radius chosen in Settings', async () => {
  const requests = [];
  const client = create({
    baseURL: 'https://api.test',
    adapter: async (config) => {
      requests.push(config.params);
      return { status: 200, statusText: 'OK', headers: {}, config, data: { incidents: [] } };
    },
  });
  const stubs = {
    '@/common/lib/api/axios': { api: client },
    '@/common/lib/storage/preferenceStorage': { preferenceStorage: memoryStorage() },
  };
  const load = Module._load;
  Module._load = function (request, ...rest) {
    return stubs[request] ?? load.call(this, request, ...rest);
  };
  let services;
  try {
    services = {
      ...require('../src/features/safety/nearbyServices.ts'),
      ...require('../src/features/settings/settingsService.ts'),
    };
  } finally {
    Module._load = load;
  }
  const { nearbyIncidents, settingsService } = services;
  await settingsService.start();

  await settingsService.update({ notifications: { accident_nearby: false } });
  assert.equal(await nearbyIncidents.update(fix(), false), null);
  await nearbyIncidents.refresh(fix());
  assert.deepEqual(requests, []);

  await settingsService.update({ notifications: { accident_nearby: true }, nearbyRadiusKm: 10 });
  await nearbyIncidents.update(fix(), false);
  assert.deepEqual(requests, [{ latitude: 36.75, longitude: 3.05, radiusKm: 10 }]);
});

test('remembers own and alerted incidents after a restart', async () => {
  const storage = memoryStorage();
  const before = fixture({ incidents: [incident('mine', 100), incident('seen', 300)], storage });
  await before.service.markOwn('mine');
  assert.equal((await before.service.update(fix(), false)).id, 'seen');

  const after = fixture({ incidents: [incident('mine', 100), incident('seen', 300)], storage });
  assert.equal(await after.service.update(fix(), false), null);
  assert.deepEqual(after.shown(), ['seen']);
});

test('a failed check keeps the last list and retries on the next update', async () => {
  const f = fixture({ incidents: [incident('near', 800)] });
  await f.service.update(fix(), true);
  f.server.fail = true;
  f.advance(2 * MINUTE);
  assert.equal(await f.service.update(fix(), false), null);
  assert.deepEqual(f.shown(), ['near']);
  f.server.fail = false;
  assert.equal((await f.service.update(fix(), false)).id, 'near');
});

test('refresh checks at once without alerting, for an alert opened from a push', async () => {
  const f = fixture({ incidents: [incident('pushed', 900)] });
  await f.service.update(fix(), true);
  f.server.incidents = [incident('pushed', 900), incident('newer', 400)];
  await f.service.refresh(fix());
  assert.equal(f.queries.length, 2);
  assert.equal(f.service.find('newer').id, 'newer');
  f.advance(2 * MINUTE);
  assert.equal((await f.service.update(fix(), false)).id, 'newer');
});

test('turns incidents and a route into map features', () => {
  const [marker] = incidentFeatures([incident('near', 800)]);
  assert.deepEqual(marker.geometry.coordinates, [3.05, 36.75 + 800 / 111_000]);
  assert.equal(marker.properties.severity, 'serious');
  assert.deepEqual(routeFeatures([{ latitude: 1, longitude: 2 }]), []);
  const [line] = routeFeatures([{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }]);
  assert.deepEqual(line.geometry.coordinates, [[2, 1], [4, 3]]);
});

test('the mock backend serves a valid incident near the driver', async () => {
  const storage = { values: new Map(), getItem(key) { return this.values.get(key) ?? null; }, setItem(key, value) { this.values.set(key, value); } };
  const client = create({ baseURL: 'https://mock.test', adapter: createMockBackend(storage, 0) });
  client.interceptors.request.use((request) => {
    request.headers.set('Authorization', 'Bearer mock-access.mock-demo');
    return request;
  });
  const { incidents } = await createSafetyApi(client).getNearbyIncidents({ latitude: 36.75, longitude: 3.05, radiusKm: 5 });
  assert.equal(incidents.length, 4);
  const [mock] = incidents;
  assert.ok(mock.location.latitude > 36.75);
  assert.equal(mock.roadName, 'RN 5');
  const again = await createSafetyApi(client).getNearbyIncidents({ latitude: 36.7501, longitude: 3.0501, radiusKm: 5 });
  assert.equal(again.incidents[0].id, mock.id);
});

test('an incident may name the driver and car, and never needs to', () => {
  const { incidentSchema } = require('../src/features/safety/types/safety.schemas.ts');
  const base = {
    id: '00000000-0000-4000-8000-000000000001', source: 'user_report', location: { latitude: 36.7, longitude: 3 },
    occurredAt: '2026-10-30T10:00:00Z', type: 'collision', severity: 'serious', injuriesVisible: true, roadName: 'RN 5', distanceMeters: 100,
  };
  assert.equal(incidentSchema.parse(base).involved, undefined);
  const involved = { firstName: 'Yacine', vehicle: 'Renault Symbol' };
  assert.deepEqual(incidentSchema.parse({ ...base, involved }).involved, involved);
});
