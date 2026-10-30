const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { create } = require('axios');
const { createStore } = require('zustand/vanilla');

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

const { createOsrmApi } = require('../src/features/roads/api/osrmApi.ts');
const { roadFromMatch, roadFromNearest, splitRefs } = require('../src/features/roads/utils/road.utils.ts');
const { createRoadService } = require('../src/features/roads/utils/roadService.ts');

const step = (name, ref) => ({ name, ref, distance: 10, duration: 1, maneuver: { type: 'turn', location: [3, 36] } });
const match = (name, ref, confidence = 0.9) => ({
  matchings: [{ confidence, legs: [{ steps: [step(name, ref)], annotation: { nodes: [1, 2] } }] }],
});

function clientFor(data) {
  const requests = [];
  const client = create({
    baseURL: 'https://osrm.test',
    adapter: async (config) => {
      requests.push(config);
      return { status: 200, data, statusText: '', headers: {}, config };
    },
  });
  return { client, requests };
}

function drive(overrides = {}) {
  const f = {
    time: 1_000_000, calls: [], results: [], latitude: 36.75,
    location: createStore(() => ({ status: 'watching', drivingState: 'driving', fix: null })),
  };
  const next = (kind, argument) => {
    f.calls.push({ kind, argument });
    const result = f.results.shift() ?? match('Road', 'RN 1');
    if (result instanceof Error) return Promise.reject(result);
    if (kind === 'nearest' && result.matchings) {
      const [{ name }] = result.matchings[0].legs[0].steps;
      return Promise.resolve({ waypoints: [{ name, distance: 1, nodes: [] }] });
    }
    return Promise.resolve(result);
  };
  f.service = createRoadService({
    match: (trace) => next('match', trace),
    nearest: (point) => next('nearest', point),
    ...overrides,
  }, f.location, () => f.time);
  f.service.start();
  f.fix = async (seconds = 6) => {
    f.time += seconds * 1000;
    f.latitude += 0.0015;
    f.location.setState({
      fix: { latitude: f.latitude, longitude: 3, accuracy: 8, timestamp: f.time, heading: 0, speedMs: 20, speedKmh: 72 },
    });
    await new Promise(setImmediate);
  };
  f.state = () => f.service.store.getState();
  return f;
}

test('road numbers are split and trimmed', () => {
  assert.deepEqual(splitRefs('RN 63; CW 111'), ['RN 63', 'CW 111']);
  assert.deepEqual(splitRefs(undefined), []);
});

test('the road comes from the last named step of the newest stretch', () => {
  const response = {
    matchings: [
      { confidence: 0.9, legs: [{ steps: [step('Old road')] }] },
      { confidence: 0.8, legs: [{ steps: [step('First')] }, { steps: [step('Main road', 'RN 5'), step('')], annotation: { nodes: [7, 8] } }] },
    ],
  };
  assert.deepEqual(roadFromMatch(response, 5), { name: 'Main road', refs: ['RN 5'], osmNodeIds: [7, 8], updatedAt: 5 });
});

test('a numbered road with no name still counts', () => {
  assert.deepEqual(roadFromMatch(match('', 'RN 1'), 1).refs, ['RN 1']);
  assert.equal(roadFromMatch(match('', 'RN 1'), 1).name, null);
});

test('a low-confidence match is rejected', () => {
  assert.equal(roadFromMatch(match('Road', undefined, 0.1), 1), null);
  assert.equal(roadFromMatch({ matchings: [] }, 1), null);
});

test('nearest gives the name only, and nothing for an unnamed road', () => {
  assert.deepEqual(roadFromNearest({ waypoints: [{ name: 'Rue', distance: 1, nodes: [1] }] }, 2), {
    name: 'Rue', refs: [], osmNodeIds: [1], updatedAt: 2,
  });
  assert.equal(roadFromNearest({ waypoints: [{ name: '', distance: 1, nodes: [] }] }, 2), null);
});

test('coordinates go longitude first, with timestamps in seconds', async () => {
  const { client, requests } = clientFor(match('Road'));
  await createOsrmApi(client).match([
    { latitude: 36.1, longitude: 3.2, timestamp: 1_000_000, accuracy: 8 },
    { latitude: 36.2, longitude: 3.3, timestamp: 1_010_000, accuracy: null },
  ]);
  assert.equal(requests[0].url, '/match/v1/driving/3.200000,36.100000;3.300000,36.200000');
  assert.equal(requests[0].params.timestamps, '1000;1010');
  assert.equal(requests[0].params.radiuses, '10;25');
  assert.equal(requests[0].headers.get('Authorization'), undefined);
});

test('a route is returned in the app\'s own coordinates', async () => {
  const { client } = clientFor({
    routes: [{
      distance: 1200, duration: 90,
      geometry: { coordinates: [[3.1, 36.1], [3.2, 36.2]] },
      legs: [{ steps: [step('Rue A')] }],
    }],
  });
  const route = await createOsrmApi(client).route({ latitude: 36.1, longitude: 3.1 }, { latitude: 36.2, longitude: 3.2 });
  assert.equal(route.distanceMeters, 1200);
  assert.deepEqual(route.coordinates[1], { latitude: 36.2, longitude: 3.2 });
  assert.equal(route.steps[0].name, 'Rue A');
});

test('the first fixes use nearest, then the trace uses match', async () => {
  const f = drive();
  f.results.push({ waypoints: [{ name: 'Rue', distance: 1, nodes: [1] }] });
  await f.fix();
  assert.equal(f.state().road.name, 'Rue');
  await f.fix();
  await f.fix();
  assert.deepEqual(f.calls.map(({ kind }) => kind), ['nearest', 'nearest', 'match']);
});

test('requests are throttled to one every 3 seconds', async () => {
  const f = drive();
  for (let i = 0; i < 6; i += 1) await f.fix(1);
  assert.equal(f.calls.length, 2);
});

test('slow traffic waits, but still refreshes every 15 seconds', async () => {
  const f = drive();
  const crawl = async (seconds) => {
    f.time += seconds * 1000;
    f.latitude += 0.00015;
    f.location.setState({ fix: { latitude: f.latitude, longitude: 3, accuracy: 8, timestamp: f.time } });
    await new Promise(setImmediate);
  };
  await f.fix();
  const before = f.calls.length;
  await crawl(4);
  await crawl(4);
  assert.equal(f.calls.length, before);
  await crawl(16);
  assert.equal(f.calls.length, before + 1);
});

test('the road changes only after two matches agree', async () => {
  const f = drive();
  f.results.push(match('Road A'), match('Road A'), match('Road A'), match('Road B'), match('Road B'));
  for (let i = 0; i < 3; i += 1) await f.fix();
  assert.equal(f.state().road.name, 'Road A');
  await f.fix();
  assert.equal(f.state().road.name, 'Road A');
  await f.fix();
  assert.equal(f.state().road.name, 'Road B');
});

test('one stray match does not change the road', async () => {
  const f = drive();
  f.results.push(match('Road A'), match('Road A'), match('Road A'), match('Side road'), match('Road A'), match('Side road'));
  for (let i = 0; i < 6; i += 1) await f.fix();
  assert.equal(f.state().road.name, 'Road A');
});

test('offline keeps the last road and marks it stale, then recovers', async () => {
  const f = drive();
  f.results.push(match('Road A'), new Error('offline'));
  await f.fix();
  assert.equal(f.state().stale, false);
  await f.fix();
  assert.equal(f.state().road.name, 'Road A');
  assert.equal(f.state().stale, true);
  await f.fix();
  assert.equal(f.state().stale, false);
});

test('a bad match does not replace the road', async () => {
  const f = drive();
  f.results.push(match('Road A'), match('Road A'), match('Nope', undefined, 0.05));
  for (let i = 0; i < 3; i += 1) await f.fix();
  assert.equal(f.state().road.name, 'Road A');
  assert.equal(f.state().stale, true);
});

test('nothing is requested unless driving', async () => {
  const f = drive();
  f.location.setState({ drivingState: 'walking' });
  await f.fix();
  await f.fix();
  assert.deepEqual(f.calls, []);
});

test('only one request runs at a time', async () => {
  let release;
  const f = drive({ nearest: () => new Promise((resolve) => { release = resolve; }) });
  await f.fix();
  await f.fix();
  await f.fix();
  release({ waypoints: [] });
  assert.ok(release);
});

test('a reply after stopping is ignored', async () => {
  let release;
  const f = drive({ nearest: () => new Promise((resolve) => { release = resolve; }) });
  await f.fix();
  f.service.stop();
  release({ waypoints: [{ name: 'Late', distance: 1, nodes: [] }] });
  await new Promise(setImmediate);
  assert.equal(f.state().road, null);
});
