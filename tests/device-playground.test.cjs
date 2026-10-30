const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const { SensorSession } = require('../src/features/device-playground/utils/SensorSession.ts');
const { PlaygroundRegistry } = require('../src/features/device-playground/utils/PlaygroundRegistry.ts');
const { ShakeDetector, StepCounter, magnitude, radiansToDegrees, speedKmh, headingDirection, formatNumber } = require('../src/features/device-playground/utils/sensor.utils.ts');

const permission = { granted: true, status: 'granted', canAskAgain: true };
function fixture(overrides = {}) {
  let data;
  let error;
  let subscriptions = 0;
  let removals = 0;
  const driver = {
    available: async () => true,
    getPermission: async () => permission,
    requestPermission: async () => permission,
    subscribe(onData, onError) {
      data = onData; error = onError; subscriptions++;
      return { remove() { removals++; } };
    },
    unavailableMessage: 'Hardware unavailable',
    ...overrides,
  };
  const session = new SensorSession(driver);
  session.setActive(true);
  return { session, emit: (reading) => data(reading), fail: (reason) => error(reason), subscriptions: () => subscriptions, removals: () => removals };
}
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('rapid Start presses create one subscription; Stop removes it and ignores late samples', async () => {
  const f = fixture();
  await Promise.all([f.session.start(), f.session.start(), f.session.start()]);
  assert.equal(f.subscriptions(), 1);
  f.emit({ x: 1 });
  f.session.stop();
  f.emit({ x: 99 });
  assert.equal(f.removals(), 1);
  assert.equal(f.session.getSnapshot().phase, 'stopped');
  assert.deepEqual(f.session.getSnapshot().data, { x: 1 });
});

test('permission denial creates no listener and preserves canAskAgain', async () => {
  const denied = { granted: false, status: 'denied', canAskAgain: false };
  let asks = 0;
  const f = fixture({ getPermission: async () => denied, requestPermission: async () => { asks++; return denied; } });
  await f.session.start();
  assert.equal(f.session.getSnapshot().phase, 'denied');
  assert.equal(f.session.getSnapshot().permission.canAskAgain, false);
  assert.equal(asks, 0);
  assert.equal(f.subscriptions(), 0);
});

test('an undetermined permission is requested only on explicit Start', async () => {
  let asks = 0;
  const f = fixture({
    getPermission: async () => ({ granted: false, status: 'undetermined', canAskAgain: true }),
    requestPermission: async () => { asks++; return permission; },
  });
  assert.equal(asks, 0);
  await f.session.start();
  assert.equal(asks, 1);
  assert.equal(f.subscriptions(), 1);
  f.session.stop();
});

test('Stop during a permission prompt prevents subscription creation after grant', async () => {
  const gate = deferred();
  const prompted = deferred();
  const f = fixture({ getPermission: async () => { prompted.resolve(); return gate.promise; } });
  const start = f.session.start();
  await prompted.promise;
  f.session.stop();
  gate.resolve(permission);
  await start;
  assert.equal(f.subscriptions(), 0);
  assert.equal(f.session.getSnapshot().phase, 'stopped');
});

test('a subscription resolving after navigation away is immediately removed', async () => {
  const gate = deferred();
  const subscribing = deferred();
  let removed = 0;
  const f = fixture({ subscribe: () => { subscribing.resolve(); return gate.promise; } });
  const start = f.session.start();
  await subscribing.promise;
  f.session.setActive(false);
  gate.resolve({ remove() { removed++; } });
  await start;
  assert.equal(removed, 1);
  assert.equal(f.session.getSnapshot().phase, 'stopped');
  f.session.setActive(true);
  assert.equal(f.session.getSnapshot().phase, 'stopped', 'foregrounding must not restart a test');
});

test('unavailable hardware never prompts for permission or fabricates readings', async () => {
  let asks = 0;
  const f = fixture({ available: async () => false, getPermission: async () => { asks++; return permission; } });
  await f.session.start();
  assert.equal(f.session.getSnapshot().phase, 'unavailable');
  assert.equal(f.session.getSnapshot().data, null);
  assert.equal(f.subscriptions(), 0);
  assert.equal(asks, 0);
});

test('native subscription errors remove the listener and show an error', async () => {
  const f = fixture();
  await f.session.start();
  f.fail('GPS was turned off');
  assert.equal(f.removals(), 1);
  assert.equal(f.session.getSnapshot().phase, 'error');
  assert.equal(f.session.getSnapshot().error, 'GPS was turned off');
});

test('a silent sensor times out and removes its listener', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = fixture({ firstSampleTimeoutMs: 8_000 });
  await f.session.start();
  t.mock.timers.tick(8_001);
  assert.equal(f.session.getSnapshot().phase, 'error');
  assert.equal(f.removals(), 1);
});

test('sensor UI commits at most every 125 ms and cancels trailing updates on Stop', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000 });
  const f = fixture();
  await f.session.start();
  f.emit({ x: 1 });
  t.mock.timers.tick(50);
  f.emit({ x: 2 });
  t.mock.timers.tick(50);
  f.emit({ x: 3 });
  assert.equal(f.session.getSnapshot().data.x, 1);
  t.mock.timers.tick(25);
  assert.equal(f.session.getSnapshot().data.x, 3);
  t.mock.timers.tick(25);
  f.emit({ x: 4 });
  assert.equal(f.session.getSnapshot().data.x, 3);
  f.session.stop();
  t.mock.timers.tick(200);
  assert.equal(f.session.getSnapshot().data.x, 3);
});

test('GPS refresh is one-shot, can run beside a watch, and ignores results after Stop', async () => {
  const gate = deferred();
  let reads = 0;
  const f = fixture({ read: async () => { reads++; return { latitude: 12 }; } });
  await f.session.refresh();
  assert.equal(f.subscriptions(), 0);
  assert.equal(reads, 1);
  assert.equal(f.session.getSnapshot().phase, 'stopped');
  await f.session.start();
  await Promise.all([f.session.refresh(), f.session.refresh()]);
  assert.equal(f.subscriptions(), 1);
  assert.equal(reads, 2);
  assert.equal(f.session.getSnapshot().phase, 'running');
  f.session.stop();
  const late = fixture({ read: () => gate.promise });
  const reading = late.session.refresh();
  await new Promise((resolve) => setImmediate(resolve));
  late.session.stop();
  gate.resolve({ latitude: 99 });
  await reading;
  assert.equal(late.session.getSnapshot().data, null);
});

test('permission loss during refresh stops the existing watch', async () => {
  let allowed = true;
  const denied = { granted: false, status: 'denied', canAskAgain: false };
  const f = fixture({ getPermission: async () => allowed ? permission : denied, read: async () => ({ latitude: 1 }) });
  await f.session.start();
  allowed = false;
  await f.session.refresh();
  assert.equal(f.removals(), 1);
  assert.equal(f.session.getSnapshot().phase, 'denied');
  assert.equal(f.session.getSnapshot().refreshing, false);
});

test('independent sessions do not start or stop each other', async () => {
  const accel = fixture();
  const shake = fixture();
  await shake.session.start();
  assert.equal(accel.subscriptions(), 0);
  await accel.session.start();
  accel.session.stop();
  assert.equal(shake.session.getSnapshot().phase, 'running');
  assert.equal(shake.removals(), 0);
  shake.session.stop();
});

test('overview publishes phase changes, not every hardware sample', () => {
  const registry = new PlaygroundRegistry();
  let updates = 0;
  registry.subscribe(() => { updates++; });
  registry.update('gps', 'running');
  registry.update('gps', 'running');
  assert.equal(updates, 1);
  let stopped = 0;
  const unregister = registry.register('gps', () => { stopped++; });
  registry.stopAll();
  assert.equal(stopped, 1);
  unregister();
  assert.equal(registry.getSnapshot().gps, 'stopped');
});

test('shake detection requires a sudden threshold crossing and obeys cooldown and reset', () => {
  const detector = new ShakeDetector();
  const sample = (g, time) => detector.sample({ x: 0, y: 0, z: g }, time);
  sample(1, 0);
  assert.equal(sample(3, 100).count, 1);
  sample(1, 200);
  assert.equal(sample(3, 300).count, 1);
  sample(1, 1_100);
  assert.equal(sample(3, 1_200).count, 2);
  assert.equal(sample(3.1, 3_000).count, 2, 'sustained high acceleration must not repeat');
  detector.threshold = 4;
  sample(1, 4_000);
  assert.equal(sample(3, 4_100).count, 2);
  detector.reset();
  assert.equal(detector.count, 0);
  assert.equal(detector.detectedAt, null);
});

test('step reset rebases the cumulative hardware counter', () => {
  const counter = new StepCounter();
  assert.deepEqual(counter.sample(12), { steps: 12, rawSteps: 12 });
  assert.deepEqual(counter.reset(), { steps: 0, rawSteps: 12 });
  assert.deepEqual(counter.sample(15), { steps: 3, rawSteps: 15 });
});

test('units and missing measurements are handled without invented zeroes', () => {
  assert.equal(magnitude({ x: 3, y: 4, z: 0 }), 5);
  assert.equal(magnitude({ x: NaN, y: 0, z: 0 }), null);
  assert.equal(radiansToDegrees(Math.PI), 180);
  assert.equal(speedKmh(10), 36);
  assert.equal(speedKmh(-1), null);
  assert.equal(formatNumber(null), '—');
  assert.equal(headingDirection(-1), 'Unavailable');
  assert.equal(headingDirection(90), 'E');
});
