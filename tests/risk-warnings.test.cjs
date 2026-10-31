const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

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

const { scoreArea } = require('../src/features/road-risk/utils/roadRiskModel.ts');
const {
  assessDrive, createHarshDrivingMonitor, createRiskWarningEngine, safeSpeedKmh, upcomingSegments, warningReasons,
} = require('../src/features/road-risk/utils/riskWarnings.ts');
const { findCurrentSegment } = require('../src/features/road-risk/utils/roadSegments.ts');
const { parseAlert, toAlertData } = require('../src/features/alerts/utils/alertRules.ts');

const NOON = new Date(2026, 9, 31, 12).getTime();
const weather = (overrides) => ({
  available: true, validAt: '', temperatureC: 15, precipitationMmPerHour: 0, visibilityM: 10_000, windSpeedMs: 2,
  windGustMs: 3, isDay: true, icingRisk: 'unknown', icingMethod: 'weather-heuristic-v1', ...overrides,
});
const wet = weather({ precipitationMmPerHour: 5 });
const road = (id, fromLatitude, overrides = {}) => ({
  id,
  name: 'RN 1',
  roadClass: 'primary',
  coordinates: [
    { latitude: fromLatitude, longitude: 3.05 },
    { latitude: fromLatitude + 0.004, longitude: 3.05 },
  ],
  lengthMeters: 445,
  curvatureDegreesPerKm: 0,
  junctionCount: 0,
  maxSpeedKmh: null,
  lit: null,
  ...overrides,
});
const easy = road('easy', 36.7);
const risky = road('risky', 36.704, { curvatureDegreesPerKm: 500, junctionCount: 6 });
const after = road('after', 36.708);
const segments = [easy, risky, after];

// A drive north at a steady speed, one fix a second, through every step of the real logic.
function drive(speedKmh, { seconds = 150, conditions = wet, startAt = NOON, harsh = false, engine = createRiskWarningEngine() } = {}) {
  const risks = scoreArea(segments, { now: startAt, weather: conditions, incidents: [] });
  const warnings = [];
  for (let second = 0; second < seconds; second += 1) {
    const driver = { latitude: 36.7 + (((speedKmh / 3.6) * second) / 111_320), longitude: 3.05, heading: 0 };
    const current = findCurrentSegment(segments, driver, 'RN 1');
    const assessment = assessDrive({ segments, risks, current, driver, speedKmh, harshDriving: harsh, weather: conditions });
    const warning = engine.update(assessment, speedKmh, startAt + second * 1000);
    if (warning) warnings.push({ ...warning, second });
  }
  return warnings;
}

test('driving into a high-risk road at high speed warns exactly once', () => {
  const warnings = drive(90);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].segmentId, 'risky');
  assert.ok(warnings[0].reasons.length > 0);
});

test('the warning comes before the driver reaches the risky road', () => {
  const [warning] = drive(90);
  const reachesAt = ((36.704 - 36.7) * 111_320) / (90 / 3.6);
  assert.ok(warning.second < reachesAt, `warned at ${warning.second}s, reached at ${reachesAt}s`);
});

test('a careful driver on the same road is not warned', () => {
  assert.deepEqual(drive(30), []);
});

test('fast driving on an easy road in good weather does not warn', () => {
  const engine = createRiskWarningEngine();
  const risks = scoreArea([easy], { now: NOON, weather: weather(), incidents: [] });
  const assessment = assessDrive({
    segments: [easy], risks, current: easy, driver: { latitude: 36.701, longitude: 3.05, heading: 0 },
    speedKmh: 85, harshDriving: false, weather: weather(),
  });
  assert.equal(engine.update(assessment, 85, NOON), null);
  assert.equal(engine.update(assessment, 85, NOON + 1000), null);
});

test('harsh driving can tip a risky road into a warning', () => {
  const dry = weather();
  const moderate = road('moderate', 36.7, { curvatureDegreesPerKm: 500, junctionCount: 6 });
  const risks = scoreArea([moderate], { now: NOON, weather: dry, incidents: [] });
  const input = {
    segments: [moderate], risks, current: moderate, driver: { latitude: 36.701, longitude: 3.05, heading: 0 },
    speedKmh: 35, weather: dry,
  };
  assert.ok(assessDrive({ ...input, harshDriving: true }).score > assessDrive({ ...input, harshDriving: false }).score);
  assert.equal(assessDrive({ ...input, harshDriving: false }).pressured, false);
  assert.equal(assessDrive({ ...input, harshDriving: true }).pressured, true);
});

test('one bad reading cannot warn', () => {
  const engine = createRiskWarningEngine();
  const high = { segmentId: 'a', score: 0.9, factors: [], pressured: true };
  assert.equal(engine.update(high, 90, NOON), null);
  assert.equal(engine.update(null, 90, NOON + 1000), null);
  assert.equal(engine.update(high, 90, NOON + 2000), null);
  assert.notEqual(engine.update(high, 90, NOON + 3000), null);
});

test('warnings keep their gap, stay off a warned road, and have an hourly cap', () => {
  const engine = createRiskWarningEngine();
  const high = (segmentId) => ({ segmentId, score: 0.9, factors: [], pressured: true });
  const warn = (id, at) => {
    engine.update(null, 90, at);
    engine.update(high(id), 90, at + 1);
    return engine.update(high(id), 90, at + 2);
  };
  assert.notEqual(warn('a', NOON), null);
  assert.equal(warn('b', NOON + 60_000), null);
  assert.equal(warn('a', NOON + 5 * 60_000), null);
  assert.notEqual(warn('b', NOON + 6 * 60_000), null);

  let sent = 2;
  for (let index = 0; index < 8; index += 1) {
    if (warn(`road ${index}`, NOON + (7 + index * 3) * 60_000)) sent += 1;
  }
  assert.equal(sent, 6);
});

test('a slow driver is not warned, whatever the road', () => {
  const engine = createRiskWarningEngine();
  const high = { segmentId: 'a', score: 0.9, factors: [], pressured: true };
  engine.update(high, 20, NOON);
  assert.equal(engine.update(high, 20, NOON + 1000), null);
});

test('the safe speed falls with curves and weather, and stays under a marked limit', () => {
  const plain = road('a', 36.7);
  const dry = safeSpeedKmh(plain, weather());
  assert.ok(safeSpeedKmh(plain, wet) < dry);
  assert.ok(safeSpeedKmh(plain, weather({ icingRisk: 'possible' })) < safeSpeedKmh(plain, wet));
  assert.ok(safeSpeedKmh(plain, weather({ visibilityM: 200 })) < dry);
  assert.ok(safeSpeedKmh({ ...plain, curvatureDegreesPerKm: 500 }, null) < safeSpeedKmh(plain, null));
  assert.ok(safeSpeedKmh({ ...plain, maxSpeedKmh: 50 }, null) <= 50);
  assert.equal(safeSpeedKmh(plain, weather({ available: false, icingRisk: 'possible' })), safeSpeedKmh(plain, null));
});

test('only the same road ahead counts', () => {
  const driver = { latitude: 36.7035, longitude: 3.05, heading: 0 };
  const behind = road('behind', 36.69);
  const side = road('side', 36.704, { name: 'Side street' });
  const ids = (heading) => upcomingSegments([behind, side, risky], easy, { ...driver, heading }, 90).map(({ id }) => id);
  assert.deepEqual(ids(0), ['risky']);
  assert.deepEqual(ids(180), []);
  assert.deepEqual(ids(null), []);
});

test('harsh braking and cornering are noticed, and normal driving is not', () => {
  const fixes = (...speeds) => speeds.map(([speedMs, heading], index) => ({ speedMs, heading, timestamp: NOON + index * 1000 }));
  const run = (list) => {
    const monitor = createHarshDrivingMonitor();
    list.forEach(monitor.add);
    return monitor.isRecent(NOON + 5000);
  };
  assert.equal(run(fixes([25, 0], [20, 0])), true);
  assert.equal(run(fixes([25, 0], [24, 0])), false);
  assert.equal(run(fixes([20, 0], [20, 15])), true);
  assert.equal(run(fixes([20, 0], [20, 3])), false);
  assert.equal(run(fixes([20, 358], [20, 2])), false);
  assert.equal(run(fixes([null, 0], [10, 0])), false);

  const monitor = createHarshDrivingMonitor();
  fixes([25, 0], [20, 0]).forEach(monitor.add);
  assert.equal(monitor.isRecent(NOON + 3 * 60_000), false);
});

test('a long gap between fixes is not read as braking', () => {
  const monitor = createHarshDrivingMonitor();
  monitor.add({ speedMs: 25, heading: 0, timestamp: NOON });
  monitor.add({ speedMs: 0, heading: 0, timestamp: NOON + 20_000 });
  assert.equal(monitor.isRecent(NOON + 20_000), false);
});

test('reasons lead with what the driver can act on', () => {
  const factors = [
    { id: 'roadClass', contribution: 0.25 }, { id: 'tooFast', contribution: 0.2 }, { id: 'wet', contribution: 0.15 },
  ];
  assert.deepEqual(warningReasons(factors), ['tooFast', 'wet']);
  assert.deepEqual(warningReasons([factors[0]]), ['roadClass']);
});

test('the reason survives the trip through the alert data', () => {
  const alert = { id: 'a', type: 'potential_accident', detail: 'Sharp curves. Slow down.' };
  assert.deepEqual(parseAlert(toAlertData(alert)), alert);
  assert.equal(parseAlert(toAlertData({ id: 'b', type: 'potential_accident' })).detail, undefined);
});
