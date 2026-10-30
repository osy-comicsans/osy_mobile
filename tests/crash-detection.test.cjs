const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createStore } = require('zustand/vanilla');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const { CHECK_IN_CONFIDENCE, replayTrace } = require('../src/features/crash-detection/utils/crash.utils.ts');
const { createCrashDetectionService } = require('../src/features/crash-detection/utils/crashDetectionService.ts');
const {
  crashTrace, droppedPhoneTrace, hardBrakingTrace, potholeTrace,
} = require('../src/features/crash-detection/utils/crashTraces.ts');

// The first sample at or above 4 g arrives 40 ms into the default impact pulse.
const IMPACT_AT = 10_040;

const merge = (...traces) => ({
  acceleration: traces.flatMap((trace) => trace.acceleration),
  rotation: traces.flatMap((trace) => trace.rotation),
  fixes: traces.flatMap((trace) => trace.fixes),
});
const keepFixes = (trace, keep) => ({ ...trace, fixes: trace.fixes.filter(keep) });

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('detects a frontal crash with its snapshot', () => {
  const events = replayTrace(crashTrace());
  assert.equal(events.length, 1);
  const [{ confidence, detectedAt, snapshot }] = events;
  assert.ok(confidence >= CHECK_IN_CONFIDENCE);
  assert.equal(snapshot.impactAt, IMPACT_AT);
  assert.equal(snapshot.speedBeforeKmh, 50);
  assert.ok(snapshot.peakG > 6);
  assert.equal(snapshot.vehicleStopped, true);
  assert.equal(snapshot.phoneStill, true);
  assert.equal(snapshot.rotated, false);
  assert.equal(snapshot.location.speedKmh, 0);
  // Decided once GPS shows the stop, not after the full timeout.
  assert.ok(detectedAt - IMPACT_AT <= 4_000);
});

test('a rollover adds rotation evidence', () => {
  const [plain] = replayTrace(crashTrace());
  const [rollover] = replayTrace(crashTrace({ rollover: true }));
  assert.equal(rollover.snapshot.rotated, true);
  assert.ok(rollover.confidence > plain.confidence);
});

test('a harder, faster crash scores higher', () => {
  const [mild] = replayTrace(crashTrace({ speedKmh: 30, peakG: 4.5 }));
  const [severe] = replayTrace(crashTrace({ speedKmh: 90, peakG: 10 }));
  assert.ok(severe.confidence > mild.confidence);
  assert.ok(severe.confidence <= 1);
});

test('a phone dropped while parked is not a crash', () => {
  assert.deepEqual(replayTrace(droppedPhoneTrace()), []);
});

test('a phone dropped as the car brakes to a stop is not a crash', () => {
  assert.deepEqual(replayTrace(droppedPhoneTrace({ speedKmh: 50 })), []);
});

test('hard braking without an impact is not a crash', () => {
  assert.deepEqual(replayTrace(hardBrakingTrace()), []);
});

test('a jolt the car drives on from is not a crash', () => {
  assert.deepEqual(replayTrace(potholeTrace()), []);
});

test('reports a crash that slides on for seconds before it stops', () => {
  const [event] = replayTrace(crashTrace({ speedKmh: 90, rollover: true, slideMs: 6_000 }));
  assert.equal(event.snapshot.vehicleStopped, true);
  assert.ok(event.confidence >= CHECK_IN_CONFIDENCE);
});

test('a jolt followed by an ordinary stop stays below the check-in threshold', () => {
  const [event] = replayTrace(potholeTrace({ speedKmh: 25, stopMs: 4_000 }));
  assert.equal(event.snapshot.vehicleStopped, false);
  assert.ok(event.confidence < CHECK_IN_CONFIDENCE);
});

test('a vehicle that leaves the ground is not mistaken for a dropped phone', () => {
  assert.equal(replayTrace(crashTrace({ airborneMs: 800 })).length, 1);
});

test('needs a recent driving speed before the impact', () => {
  assert.deepEqual(replayTrace(crashTrace({ speedKmh: 10 })), []);
  const stale = keepFixes(crashTrace(), (fix) => fix.timestamp < 4_000 || fix.timestamp > IMPACT_AT);
  assert.deepEqual(replayTrace(stale), []);
});

test('still reports a crash when GPS is lost after it, with less confidence', () => {
  const [confirmed] = replayTrace(crashTrace());
  const [event] = replayTrace(keepFixes(crashTrace(), (fix) => fix.timestamp < IMPACT_AT));
  assert.equal(event.snapshot.vehicleStopped, false);
  assert.ok(event.confidence < confirmed.confidence);
  assert.equal(event.detectedAt - IMPACT_AT, 10_000);
});

test('stays quiet for two minutes after reporting a crash', () => {
  assert.equal(replayTrace(merge(crashTrace(), crashTrace({ start: 30_000 }))).length, 1);
  assert.equal(replayTrace(merge(crashTrace(), crashTrace({ start: 200_000 }))).length, 2);
});

function serviceFixture({ available = async () => true, gate = Promise.resolve() } = {}) {
  const location = createStore(() => ({ status: 'watching', drivingState: 'stationary', fix: null }));
  const subscriptions = [];
  let clock = 0;
  const driver = {
    available,
    async subscribe(onAcceleration, onRotation) {
      await gate;
      const subscription = { onAcceleration, onRotation, removed: false, remove() { this.removed = true; } };
      subscriptions.push(subscription);
      return subscription;
    },
  };
  const service = createCrashDetectionService(driver, location, () => clock);
  const tick = (t) => { clock = t; };
  return { service, location, subscriptions, tick, state: () => service.store.getState() };
}

// Feeds a trace in time order: fixes through the location store, motion through
// the sensors. `fixClockSkew` shifts the time each fix carries, not when it arrives.
function drive({ location, subscriptions, tick }, trace, fixClockSkew = 0) {
  const sensors = subscriptions.at(-1);
  [
    ...trace.fixes.map((fix) => [
      fix.timestamp,
      () => location.setState({ fix: { ...fix, timestamp: fix.timestamp + fixClockSkew } }),
    ]),
    ...trace.rotation.map((sample) => [sample.t, () => sensors.onRotation(sample)]),
    ...trace.acceleration.map((sample) => [sample.t, () => sensors.onAcceleration(sample)]),
  ]
    .sort((a, b) => a[0] - b[0])
    .forEach(([t, step]) => {
      tick(t);
      step();
    });
}

test('runs the sensors only while driving', async () => {
  const fixture = serviceFixture();
  fixture.service.start();
  await settle();
  assert.equal(fixture.subscriptions.length, 0);
  assert.equal(fixture.state().status, 'idle');

  fixture.location.setState({ drivingState: 'driving' });
  await settle();
  assert.equal(fixture.subscriptions.length, 1);
  assert.equal(fixture.state().status, 'monitoring');

  fixture.location.setState({ status: 'idle' });
  assert.equal(fixture.subscriptions[0].removed, true);
  assert.equal(fixture.state().status, 'idle');
});

test('reports missing sensors', async () => {
  const fixture = serviceFixture({ available: async () => false });
  fixture.location.setState({ drivingState: 'driving' });
  fixture.service.start();
  await settle();
  assert.equal(fixture.subscriptions.length, 0);
  assert.equal(fixture.state().status, 'unavailable');
});

test('emits crashDetected from live samples', async () => {
  const fixture = serviceFixture();
  const events = [];
  fixture.service.onCrashDetected((event) => events.push(event));
  fixture.location.setState({ drivingState: 'driving' });
  fixture.service.start();
  await settle();
  drive(fixture, crashTrace());
  assert.equal(events.length, 1);
  assert.equal(fixture.state().lastCrash, events[0]);
});

test('times fixes by arrival, so a GNSS clock ahead of the phone does not hide a crash', async () => {
  const fixture = serviceFixture();
  const events = [];
  fixture.service.onCrashDetected((event) => events.push(event));
  fixture.location.setState({ drivingState: 'driving' });
  fixture.service.start();
  await settle();
  drive(fixture, crashTrace(), 10 * 60_000);
  assert.equal(events.length, 1);
});

test('removes sensors that start after stop', async () => {
  let open;
  const fixture = serviceFixture({ gate: new Promise((resolve) => { open = resolve; }) });
  fixture.location.setState({ drivingState: 'driving' });
  fixture.service.start();
  await settle();
  fixture.service.stop();
  open();
  await settle();
  assert.equal(fixture.subscriptions[0].removed, true);
  assert.equal(fixture.state().status, 'idle');
});

test('simulate replays a trace through the listeners', () => {
  const fixture = serviceFixture();
  const events = [];
  const unsubscribe = fixture.service.onCrashDetected((event) => events.push(event));
  fixture.service.simulate(crashTrace({ rollover: true }));
  assert.equal(events.length, 1);
  assert.equal(events[0].snapshot.rotated, true);

  unsubscribe();
  fixture.service.simulate(crashTrace());
  assert.equal(events.length, 1);
});
