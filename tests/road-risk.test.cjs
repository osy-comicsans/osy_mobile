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

const { createOverpassApi, roadQuery } = require('../src/features/road-risk/api/overpassApi.ts');
const { overpassResponseSchema } = require('../src/features/road-risk/types/roadRisk.types.ts');
const { levelFor, scoreArea, scoreSegment } = require('../src/features/road-risk/utils/roadRiskModel.ts');
const {
  distanceToSegment, findCurrentSegment, MAX_VISIBLE_AREAS, riskAreaAround, riskAreasInView, toRoadSegments,
} = require('../src/features/road-risk/utils/roadSegments.ts');
const {
  RISK_LEVEL_COLORS, riskMapStatus, toHazardFeatures, toRiskFeatures, uniqueById,
} = require('../src/features/road-risk/utils/riskOverlay.ts');
const { hazardsAhead, toRoadHazards } = require('../src/features/road-risk/utils/roadHazards.ts');
const { toFeatureCollection } = require('../src/features/map/utils/mapOverlays.ts');
const { createMockBackend } = require('../src/common/lib/api/mock/mockBackend.ts');
const { createSafetyApi } = require('../src/features/safety/api/safetyApi.ts');
const fixture = require('./fixtures/overpass-algiers.json');

const NOON = new Date(2026, 9, 31, 12).getTime();
const MIDNIGHT = new Date(2026, 9, 31, 0).getTime();
const calm = { now: NOON, weather: null, incidents: [] };
const way = (id, coordinates, tags = { highway: 'primary' }, nodes) => ({
  type: 'way', id, tags, nodes: nodes ?? coordinates.map((_, index) => id * 100 + index),
  geometry: coordinates.map(([lat, lon]) => ({ lat, lon })),
});
const straight = way(1, [[36.75, 3.05], [36.751, 3.05], [36.752, 3.05]]);
const zigzag = way(2, [[36.75, 3.05], [36.7505, 3.051], [36.751, 3.05], [36.7515, 3.051], [36.752, 3.05]]);
const segment = (element) => toRoadSegments({ elements: [element] })[0];
const liveWeather = (overrides) => ({
  available: true, validAt: '', temperatureC: 15, precipitationMmPerHour: 0, visibilityM: 10_000, windSpeedMs: 2,
  windGustMs: 3, isDay: true, icingRisk: 'unknown', icingMethod: 'weather-heuristic-v1', ...overrides,
});
const ids = (risk) => risk.factors.map(({ id }) => id);

test('a real Algiers area returns scores with reasons', () => {
  const segments = toRoadSegments(overpassResponseSchema.parse(fixture));
  assert.ok(segments.length >= fixture.elements.length);
  const risks = scoreArea(segments, { ...calm, now: MIDNIGHT, weather: liveWeather({ isDay: false, precipitationMmPerHour: 5 }) });
  assert.equal(risks.length, segments.length);
  for (const risk of risks) {
    assert.ok(risk.score >= 0 && risk.score <= 1);
    assert.equal(risk.level, levelFor(risk.score));
    assert.ok(risk.factors.length > 0 && risk.factors.length <= 3);
  }
  assert.ok(new Set(risks.map(({ score }) => score)).size > 1);
  assert.ok(segments.some(({ maxSpeedKmh }) => maxSpeedKmh !== null));
});

test('long roads are cut into pieces that still join up', () => {
  const coordinates = Array.from({ length: 30 }, (_, index) => [36.7 + index * 0.001, 3.05]);
  const pieces = toRoadSegments({ elements: [way(3, coordinates)] });
  assert.ok(pieces.length >= 5);
  for (const piece of pieces) assert.ok(piece.lengthMeters < 620);
  pieces.slice(1).forEach((piece, index) => {
    assert.deepEqual(piece.coordinates[0], pieces[index].coordinates.at(-1));
  });
  assert.equal(new Set(pieces.map(({ id }) => id)).size, pieces.length);
});

test('junctions are nodes shared with another road, counted once', () => {
  const shared = 999;
  const a = way(4, [[36.75, 3.05], [36.751, 3.05], [36.752, 3.05]], undefined, [1, shared, 2]);
  const b = way(5, [[36.751, 3.05], [36.751, 3.051]], undefined, [shared, 3]);
  const [first, second] = toRoadSegments({ elements: [a, b] });
  assert.equal(first.junctionCount, 1);
  assert.equal(second.junctionCount, 1);
});

test('speed limits are read when clear, and never guessed', () => {
  const limit = (maxspeed) => segment(way(6, [[36.75, 3.05], [36.751, 3.05]], { highway: 'primary', maxspeed })).maxSpeedKmh;
  assert.equal(limit('50'), 50);
  assert.equal(limit('30 mph'), 48);
  assert.equal(limit('DZ:urban'), null);
  assert.equal(limit(undefined), null);
});

test('curves raise the score, and say so', () => {
  const bends = scoreSegment(segment(zigzag), calm);
  assert.ok(bends.score > scoreSegment(segment(straight), calm).score);
  assert.ok(ids(bends).includes('curves'));
});

test('each weather condition adds its own reason', () => {
  const road = segment(straight);
  const cases = [
    ['wet', { precipitationMmPerHour: 5 }], ['icing', { icingRisk: 'possible' }],
    ['visibility', { visibilityM: 150 }], ['wind', { windGustMs: 22 }],
  ];
  const base = scoreSegment(road, { ...calm, weather: liveWeather() }).score;
  for (const [id, overrides] of cases) {
    const risk = scoreSegment(road, { ...calm, weather: liveWeather(overrides) });
    assert.ok(risk.score > base, id);
    assert.ok(ids(risk).includes(id), id);
  }
});

test('stale weather adds nothing', () => {
  const road = segment(straight);
  const stale = liveWeather({ available: false, icingRisk: 'possible', precipitationMmPerHour: 9 });
  assert.equal(scoreSegment(road, { ...calm, weather: stale }).score, scoreSegment(road, calm).score);
});

test('a dark road adds risk, unless it is lit', () => {
  const dark = { ...calm, weather: liveWeather({ isDay: false }) };
  const unlit = segment(way(7, [[36.75, 3.05], [36.751, 3.05]], { highway: 'primary', lit: 'no' }));
  const lit = segment(way(7, [[36.75, 3.05], [36.751, 3.05]], { highway: 'primary', lit: 'yes' }));
  assert.ok(ids(scoreSegment(unlit, dark)).includes('darkness'));
  assert.ok(!ids(scoreSegment(lit, dark)).includes('darkness'));
  assert.ok(ids(scoreSegment(unlit, { ...calm, now: MIDNIGHT })).includes('darkness'));
});

test('only speed above a tagged limit counts', () => {
  const limited = segment(way(8, [[36.75, 3.05], [36.751, 3.05]], { highway: 'primary', maxspeed: '50' }));
  const untagged = segment(straight);
  assert.ok(ids(scoreSegment(limited, { ...calm, speedKmh: 90 })).includes('speeding'));
  assert.ok(!ids(scoreSegment(limited, { ...calm, speedKmh: 45 })).includes('speeding'));
  assert.ok(!ids(scoreSegment(untagged, { ...calm, speedKmh: 200 })).includes('speeding'));
});

test('recent nearby accidents count, and old or distant ones do not', () => {
  const road = segment(straight);
  const incident = (latitude, occurredAt, severity = 'critical') => ({
    location: { latitude, longitude: 3.05 }, occurredAt, severity,
  });
  const recent = new Date(NOON - 86_400_000).toISOString();
  const old = new Date(NOON - 100 * 86_400_000).toISOString();
  const score = (incidents) => scoreSegment(road, { ...calm, incidents }).score;
  assert.ok(score([incident(36.751, recent)]) > score([]));
  assert.equal(score([incident(36.751, old)]), score([]));
  assert.equal(score([incident(36.8, recent)]), score([]));
  const many = Array.from({ length: 9 }, () => incident(36.751, recent));
  assert.equal(score(many), Math.round((score([]) + 0.3) * 100) / 100);
});

test('the score stays between 0 and 1 in the worst conditions', () => {
  const road = segment(zigzag);
  const risk = scoreSegment(road, {
    now: MIDNIGHT,
    weather: liveWeather({ isDay: false, precipitationMmPerHour: 20, icingRisk: 'possible', visibilityM: 50, windGustMs: 30 }),
    incidents: Array.from({ length: 5 }, () => ({
      location: road.coordinates[1], occurredAt: new Date(MIDNIGHT).toISOString(), severity: 'critical',
    })),
  });
  assert.equal(risk.score, 1);
  assert.equal(risk.level, 'high');
  assert.equal(risk.factors.length, 3);
});

test('levels follow the documented thresholds', () => {
  assert.equal(levelFor(0.29), 'low');
  assert.equal(levelFor(0.3), 'medium');
  assert.equal(levelFor(0.59), 'medium');
  assert.equal(levelFor(0.6), 'high');
});

test('the current road is the matched name, then the nearest', () => {
  const near = segment(way(9, [[36.75, 3.05], [36.752, 3.05]], { highway: 'service', name: 'Near' }));
  const named = segment(way(10, [[36.75, 3.0502], [36.752, 3.0502]], { highway: 'primary', name: 'Matched' }));
  const point = { latitude: 36.751, longitude: 3.05005 };
  assert.equal(findCurrentSegment([named, near], point, null).name, 'Near');
  assert.equal(findCurrentSegment([near, named], point, 'Matched').name, 'Matched');
  assert.equal(findCurrentSegment([near], { latitude: 36.8, longitude: 3.05 }, null), null);
});

test('distance to a road is measured to its line, not its ends', () => {
  const road = segment(straight);
  assert.ok(distanceToSegment({ latitude: 36.751, longitude: 3.05 }, road) < 1);
  const meters = distanceToSegment({ latitude: 36.7505, longitude: 3.051 }, road);
  assert.ok(meters > 80 && meters < 100);
});

test('nearby points share one area, so moving does not refetch', () => {
  const area = riskAreaAround({ latitude: 36.7538, longitude: 3.0588 });
  assert.equal(riskAreaAround({ latitude: 36.7539, longitude: 3.0589 }).id, area.id);
  assert.notEqual(riskAreaAround({ latitude: 36.8, longitude: 3.0588 }).id, area.id);
  assert.ok(area.bounds.south <= 36.7538 && area.bounds.north >= 36.7538);
});

test('the road request asks for drivable roads inside the box', async () => {
  const query = roadQuery({ south: 36.74, west: 3.04, north: 36.76, east: 3.06 });
  assert.match(query, /\(36\.74000,3\.04000,36\.76000,3\.06000\)/);
  assert.ok(!/\|footway|\|path/.test(query));

  let sent;
  const client = create({
    adapter: async (request) => {
      sent = request;
      return { status: 200, statusText: '', headers: {}, config: request, data: { elements: [straight] } };
    },
  });
  const { elements } = await createOverpassApi(client).roads({ south: 1, west: 2, north: 3, east: 4 });
  assert.equal(elements.length, 1);
  assert.match(sent.data, /^data=/);
  assert.equal(sent.headers.get('Authorization'), undefined);
});

test('the Overpass client identifies the app and carries no user token', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/road-risk/api/overpassClient.ts'), 'utf8');
  assert.match(source, /'User-Agent'/);
  assert.doesNotMatch(source, /common\/lib\/api\/axios/);
});

test('hazards are read from mapped features, and roads are not mistaken for them', () => {
  const response = overpassResponseSchema.parse({
    elements: [
      { type: 'node', id: 1, lat: 36.75, lon: 3.05, tags: { traffic_calming: 'hump' } },
      { type: 'node', id: 2, lat: 36.75, lon: 3.05, tags: { highway: 'speed_camera' } },
      { type: 'node', id: 3, lat: 36.75, lon: 3.05, tags: { hazard: 'animal_crossing' } },
      { type: 'node', id: 4, lat: 36.75, lon: 3.05, tags: { hazard: 'falling_rocks' } },
      { type: 'way', id: 5, nodes: [7, 8], geometry: [{ lat: 36.76, lon: 3.06 }, { lat: 36.77, lon: 3.06 }], tags: { amenity: 'school' } },
      { type: 'node', id: 6, lat: 36.75, lon: 3.05, tags: { amenity: 'cafe' } },
      straight,
    ].map((element) => ({ type: 'way', ...element })),
  });
  const hazards = toRoadHazards(response);
  assert.deepEqual(hazards.map(({ kind }) => kind), ['bump', 'camera', 'animals', 'hazard', 'school']);
  assert.deepEqual(hazards[4].location, { latitude: 36.76, longitude: 3.06 });
  assert.equal(toRoadSegments(response).length, 1);
});

test('the request asks for bumps, cameras, schools, and hazards', () => {
  const query = roadQuery({ south: 1, west: 2, north: 3, east: 4 });
  for (const filter of ['traffic_calming', 'speed_camera', 'node["hazard"]', 'way["amenity"="school"]']) assert.ok(query.includes(filter), filter);
});

test('only hazards ahead are listed, nearest first', () => {
  const hazard = (id, latitude) => ({ id, kind: 'bump', location: { latitude, longitude: 3.05 } });
  const hazards = [hazard('far ahead', 36.754), hazard('ahead', 36.7515), hazard('behind', 36.7485), hazard('next', 36.7502)];
  const viewer = { latitude: 36.75, longitude: 3.05, heading: 0, speedKmh: 50 };
  assert.deepEqual(hazardsAhead(hazards, viewer).map(({ id }) => id), ['next', 'ahead']);
  assert.deepEqual(hazardsAhead(hazards, { ...viewer, heading: 180 }).map(({ id }) => id), ['next', 'behind']);
  assert.equal(hazardsAhead(hazards, { ...viewer, heading: null }).length, 3);
  assert.equal(hazardsAhead(hazards, { ...viewer, speedKmh: 0 }).length, 3);
  assert.deepEqual(hazardsAhead([hazard('at the car', 36.7501)], { ...viewer, heading: 180 }).map(({ id }) => id), ['at the car']);
});

test('hazards reach the map as points, longitude first', () => {
  const [feature] = toHazardFeatures([{ id: 'node:1', kind: 'school', location: { latitude: 36.75, longitude: 3.05 } }]);
  assert.deepEqual(feature.geometry, { type: 'Point', coordinates: [3.05, 36.75] });
  assert.deepEqual(feature.properties, { kind: 'school' });
});

test('map colours match the scores', () => {
  const segments = toRoadSegments(overpassResponseSchema.parse(fixture));
  const risks = new Map(scoreArea(segments, { ...calm, now: MIDNIGHT }).map((risk) => [risk.segmentId, risk]));
  const features = toRiskFeatures(segments, risks);
  assert.equal(features.length, segments.length);
  for (const { id, properties, geometry } of features) {
    assert.equal(properties.level, risks.get(id).level);
    assert.equal(geometry.type, 'LineString');
  }
  assert.ok(new Set(features.map(({ properties }) => properties.level)).size > 1);
  assert.equal(new Set(Object.values(RISK_LEVEL_COLORS)).size, 3);
});

test('map roads are longitude first, as GeoJSON needs, and keep their ids for taps', () => {
  const road = segment(straight);
  const [feature] = toRiskFeatures([road], new Map([[road.id, scoreSegment(road, calm)]]));
  assert.deepEqual(feature.geometry.coordinates[0], [3.05, 36.75]);
  assert.equal(toFeatureCollection([feature]).features[0].id, road.id);
});

test('a road with no score is not drawn', () => {
  assert.deepEqual(toRiskFeatures([segment(straight)], new Map()), []);
});

test('a road in two areas is kept once', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'a' }];
  assert.deepEqual(uniqueById(items, ({ id }) => id).map(({ id }) => id), ['a', 'b']);
});

test('the map loads the areas on screen, and stops when zoomed far out', () => {
  const view = { south: 36.745, west: 3.05, north: 36.775, east: 3.065 };
  const areas = riskAreasInView(view);
  assert.ok(areas.length >= 2 && areas.length <= MAX_VISIBLE_AREAS);
  assert.equal(new Set(areas.map(({ id }) => id)).size, areas.length);
  assert.ok(areas.some(({ id }) => id === riskAreaAround({ latitude: 36.75, longitude: 3.055 }).id));
  assert.ok(areas.some(({ id }) => id === riskAreaAround({ latitude: 36.77, longitude: 3.06 }).id));
  assert.equal(riskAreasInView({ south: 36.5, west: 2.8, north: 37, east: 3.4 }), null);
});

test('a small pan inside one area asks for nothing new', () => {
  const ids = (view) => riskAreasInView(view).map(({ id }) => id).join();
  assert.equal(
    ids({ south: 36.742, west: 3.042, north: 36.748, east: 3.048 }),
    ids({ south: 36.743, west: 3.043, north: 36.749, east: 3.049 }),
  );
});

test('road requests run one at a time, and a failure does not block the next', async () => {
  let running = 0;
  let peak = 0;
  let calls = 0;
  const client = create({
    adapter: async (request) => {
      running += 1;
      peak = Math.max(peak, running);
      calls += 1;
      const failing = calls === 1;
      await new Promise((resolve) => { setTimeout(resolve, 5); });
      running -= 1;
      if (failing) throw new Error('busy');
      return { status: 200, statusText: '', headers: {}, config: request, data: { elements: [] } };
    },
  });
  const overpass = createOverpassApi(client);
  const box = { south: 1, west: 2, north: 3, east: 4 };
  const results = await Promise.allSettled([overpass.roads(box), overpass.roads(box), overpass.roads(box)]);
  assert.deepEqual(results.map(({ status }) => status), ['rejected', 'fulfilled', 'fulfilled']);
  assert.equal(peak, 1);
});

test('the map status shows loading, then any failure', () => {
  const done = { isLoading: false, isError: false };
  const failed = { isLoading: false, isError: true };
  assert.equal(riskMapStatus([done]), 'ready');
  assert.equal(riskMapStatus([]), 'ready');
  assert.equal(riskMapStatus([done, failed]), 'failed');
  assert.equal(riskMapStatus([failed, { isLoading: true, isError: false }]), 'loading');
});

test('the mock backend answers nearby incidents', async () => {
  const storage = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  const client = create({ adapter: createMockBackend(storage, 0), headers: { Authorization: 'Bearer mock-access.mock-demo' } });
  const { incidents } = await createSafetyApi(client).getNearbyIncidents({ latitude: 36.75, longitude: 3.05, radiusKm: 3 });
  // Each area has sample accidents, for nearby alerts.
  assert.equal(incidents.length, 4);
});

test('the current road lights every part with its name', () => {
  const { currentRoadFeatures } = require('../src/features/road-risk/utils/riskOverlay.ts');
  const part = (id, name) => ({ id, name, coordinates: [{ latitude: 36.7, longitude: 3 }, { latitude: 36.8, longitude: 3.1 }] });
  const a = part('a', 'RN 5'); const b = part('b', 'RN 5'); const c = part('c', 'RN 11'); const unnamed = part('d', null);
  assert.deepEqual(currentRoadFeatures([a, b, c], a).map(({ id }) => id), ['current-a', 'current-b']);
  assert.deepEqual(currentRoadFeatures([a, unnamed], unnamed).map(({ id }) => id), ['current-d']);
  assert.deepEqual(currentRoadFeatures([a], null), []);
  assert.deepEqual(currentRoadFeatures([a], a)[0].geometry.coordinates[0], [3, 36.7]);
});
