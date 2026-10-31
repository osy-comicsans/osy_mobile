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
const {
  distanceMeters, initialDrivingTracker, msToKmh, nextDrivingTracker,
  samplingProfiles, toLocationFix, toLocationPermission,
} = require('../src/features/location/utils/location.utils.ts');
const { createLocationService } = require('../src/features/location/utils/locationService.ts');

const granted = { location: 'granted', canAskAgain: true };
const reading = (timestamp, speed, extra = {}) => ({
  timestamp,
  coords: { latitude: 36.75, longitude: 3.05, accuracy: 5, heading: 90, speed, ...extra },
});

function fixture(overrides = {}) {
  const watches = [];
  const driver = {
    servicesEnabled: async () => true,
    getPermission: async () => granted,
    requestPermission: async () => granted,
    getMotionPermission: async () => 'granted',
    requestMotionPermission: async () => 'granted',
    async watch(profile, onLocation, onError) {
      const watch = { profile, onLocation, onError, removed: false, remove() { this.removed = true; } };
      watches.push(watch);
      return watch;
    },
    ...overrides,
  };
  const service = createLocationService(driver);
  return { service, watches, state: () => service.store.getState() };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('converts m/s to km/h and ignores invalid readings', () => {
  assert.equal(msToKmh(10), 36);
  const fix = toLocationFix(reading(1, 10), null);
  assert.equal(fix.speedMs, 10);
  assert.equal(fix.speedKmh, 36);
  const unknown = toLocationFix(reading(1, -1, { heading: -1, accuracy: null }), null);
  assert.equal(unknown.speedKmh, null);
  assert.equal(unknown.heading, null);
  assert.equal(unknown.accuracy, null);
});

test('treats tiny speeds as stopped', () => {
  assert.equal(toLocationFix(reading(1, 0.1), null).speedKmh, 0);
});

test('derives missing speed from accurate fixes only', () => {
  const previous = toLocationFix(reading(0, 0), null);
  const east = { longitude: 3.0505 };
  const distance = distanceMeters(previous, { latitude: 36.75, ...east });
  const derived = toLocationFix(reading(5_000, null, east), previous);
  assert.ok(Math.abs(derived.speedMs - distance / 5) < 1e-9);
  assert.equal(toLocationFix(reading(5_000, null, { ...east, accuracy: 100 }), previous).speedMs, null);
  assert.equal(toLocationFix(reading(5_000, null), previous).speedMs, null);
  assert.equal(toLocationFix(reading(60_000, null, east), previous).speedMs, null);
});

test('enters driving only after sustained speed', () => {
  let tracker = initialDrivingTracker;
  tracker = nextDrivingTracker(tracker, 30, 0);
  tracker = nextDrivingTracker(tracker, 30, 1_000);
  assert.notEqual(tracker.state, 'driving');
  tracker = nextDrivingTracker(tracker, 30, 2_000);
  assert.equal(tracker.state, 'driving');
});

test('stays driving through a red light, then stops', () => {
  let tracker = { state: 'driving', fastSamples: 3, slowSince: null };
  tracker = nextDrivingTracker(tracker, 0, 0);
  tracker = nextDrivingTracker(tracker, 0, 119_000);
  assert.equal(tracker.state, 'driving');
  tracker = nextDrivingTracker(tracker, 30, 119_500);
  assert.equal(tracker.slowSince, null);
  tracker = nextDrivingTracker(tracker, 0, 120_000);
  tracker = nextDrivingTracker(tracker, 0, 240_000);
  assert.equal(tracker.state, 'stationary');
});

test('moves between stationary and walking, and keeps state without speed', () => {
  let tracker = nextDrivingTracker(initialDrivingTracker, 5, 0);
  assert.equal(tracker.state, 'walking');
  assert.equal(nextDrivingTracker(tracker, null, 1), tracker);
  tracker = nextDrivingTracker(tracker, 0, 1_000);
  assert.equal(tracker.state, 'walking');
  tracker = nextDrivingTracker(tracker, 0, 21_000);
  assert.equal(tracker.state, 'stationary');
});

test('maps platform permissions, including approximate access', () => {
  assert.equal(toLocationPermission({ granted: true, status: 'granted', ios: { accuracy: 'full' } }), 'granted');
  assert.equal(toLocationPermission({ granted: true, status: 'granted', ios: { accuracy: 'reduced' } }), 'limited');
  assert.equal(toLocationPermission({ granted: true, status: 'granted', android: { accuracy: 'coarse' } }), 'limited');
  assert.equal(toLocationPermission({ granted: false, status: 'denied' }), 'denied');
  assert.equal(toLocationPermission({ granted: false, status: 'undetermined' }), 'undetermined');
});

test('uses more accuracy and more samples while driving', () => {
  assert.equal(samplingProfiles.driving.accuracy, 'navigation');
  assert.ok(samplingProfiles.driving.timeInterval < samplingProfiles.stationary.timeInterval);
  assert.equal(samplingProfiles.walking.distanceInterval, 0);
  assert.equal(samplingProfiles.driving.distanceInterval, 0);
});

test('publishes live fixes while watching', async () => {
  const f = fixture();
  await f.service.start();
  assert.equal(f.state().status, 'watching');
  f.watches[0].onLocation(reading(1_000, 10));
  assert.equal(f.state().fix.speedKmh, 36);
});

test('does not watch or crash when permission is denied', async () => {
  const f = fixture({ getPermission: async () => ({ location: 'denied', canAskAgain: false }) });
  await f.service.start();
  assert.equal(f.state().status, 'permissionRequired');
  assert.equal(f.state().location, 'denied');
  assert.equal(f.state().canAskAgain, false);
  assert.equal(f.watches.length, 0);
});

test('reports disabled location services', async () => {
  const f = fixture({ servicesEnabled: async () => false });
  await f.service.start();
  assert.equal(f.state().status, 'servicesDisabled');
  assert.equal(f.watches.length, 0);
});

test('a motion failure does not block location', async () => {
  const f = fixture({ getMotionPermission: async () => { throw new Error('no sensor'); } });
  await f.service.start();
  assert.equal(f.state().motion, 'unavailable');
  assert.equal(f.state().status, 'watching');
});

test('requests location, then motion, then starts watching', async () => {
  let current = { location: 'undetermined', canAskAgain: true };
  const calls = [];
  const f = fixture({
    getPermission: async () => current,
    requestPermission: async () => { calls.push('location'); current = granted; return granted; },
    requestMotionPermission: async () => { calls.push('motion'); return 'granted'; },
  });
  await f.service.start();
  assert.equal(f.state().status, 'permissionRequired');
  await f.service.requestPermission();
  assert.deepEqual(calls, ['location', 'motion']);
  assert.equal(f.state().status, 'watching');
  assert.equal(f.state().requesting, false);
});

test('does not ask for motion after location is refused', async () => {
  let asked = false;
  const denied = { location: 'denied', canAskAgain: true };
  const f = fixture({
    getPermission: async () => denied,
    requestPermission: async () => denied,
    requestMotionPermission: async () => { asked = true; return 'granted'; },
  });
  await f.service.start();
  await f.service.requestPermission();
  assert.equal(asked, false);
  assert.equal(f.state().status, 'permissionRequired');
});

test('a dialog that backgrounds the app waits for the foreground event', async () => {
  let current = { location: 'undetermined', canAskAgain: true };
  let answer;
  const f = fixture({
    getPermission: async () => current,
    requestPermission: () => new Promise((resolve) => { answer = resolve; }),
  });
  await f.service.start();
  const request = f.service.requestPermission();
  f.service.stop();
  current = granted;
  answer(granted);
  await request;
  assert.equal(f.watches.length, 0);
  await f.service.start();
  assert.equal(f.state().status, 'watching');
  assert.equal(f.watches.length, 1);
});

test('swaps to the driving profile without a gap, and back', async () => {
  const f = fixture();
  await f.service.start();
  const [stationary] = f.watches;
  assert.equal(stationary.profile, samplingProfiles.stationary);
  for (let i = 1; i <= 3; i++) f.watches.at(-1).onLocation(reading(i * 1_000, 20));
  await settle();
  assert.equal(f.state().drivingState, 'driving');
  const driving = f.watches.at(-1);
  assert.equal(driving.profile, samplingProfiles.driving);
  assert.equal(stationary.removed, true);
  assert.equal(driving.removed, false);
  driving.onLocation(reading(10_000, 0));
  driving.onLocation(reading(130_000, 0));
  await settle();
  assert.equal(f.watches.at(-1).profile, samplingProfiles.stationary);
  assert.equal(driving.removed, true);
});

test('ignores repeated and late samples', async () => {
  const f = fixture();
  await f.service.start();
  f.watches[0].onLocation(reading(2_000, 10));
  f.watches[0].onLocation(reading(1_000, 50));
  assert.equal(f.state().fix.speedKmh, 36);
  const { onLocation } = f.watches[0];
  f.service.stop();
  onLocation(reading(3_000, 50));
  assert.equal(f.state().fix.speedKmh, 36);
});

test('removes a watch that resolves after stop', async () => {
  let release;
  const late = { removed: false, remove() { this.removed = true; } };
  const f = fixture({ watch: () => new Promise((resolve) => { release = () => resolve(late); }) });
  const starting = f.service.start();
  await settle();
  f.service.stop();
  release();
  await starting;
  assert.equal(late.removed, true);
  assert.equal(f.state().status, 'idle');
});

test('restarts cleanly while an earlier watch is still resolving', async () => {
  const pending = [];
  const f = fixture({
    watch: () => new Promise((resolve) => {
      pending.push({ resolve: () => resolve({ removed: false, remove() { this.removed = true; } }) });
    }),
  });
  const first = f.service.start();
  await settle();
  f.service.stop();
  const second = f.service.start();
  await settle();
  assert.equal(pending.length, 2);
  pending.forEach((entry) => entry.resolve());
  await Promise.all([first, second]);
  assert.equal(f.state().status, 'watching');
});

test('a watch failure removes it and allows retry', async () => {
  const f = fixture();
  await f.service.start();
  f.watches[0].onError('gps failed');
  assert.equal(f.state().status, 'error');
  assert.equal(f.watches[0].removed, true);
  assert.ok(f.state().error);
  await f.service.start();
  assert.equal(f.state().status, 'watching');
  assert.equal(f.state().error, null);
});

test('reports a watch that cannot start', async () => {
  const f = fixture({ watch: async () => { throw new Error('native failure'); } });
  await f.service.start();
  assert.equal(f.state().status, 'error');
});

test('stop removes the watch', async () => {
  const f = fixture();
  await f.service.start();
  f.service.stop();
  assert.equal(f.watches[0].removed, true);
  assert.equal(f.state().status, 'idle');
});

function backgroundFixture({ permission = 'granted' } = {}) {
  const log = [];
  const background = {
    onLocation: null,
    available: async () => true,
    getPermission: async () => permission,
    requestPermission: async () => 'granted',
    async start(profile, onLocation) {
      log.push(`start:${profile.accuracy}`);
      background.onLocation = onLocation;
    },
    async stop() { log.push('stop'); },
  };
  const f = fixture({ background });
  return { ...f, background, log };
}

const driveTo = async (f, speed = 25) => {
  for (let t = 1; t <= 6; t += 1) {
    f.watches[f.watches.length - 1].onLocation(reading(t * 1000, speed));
    await settle();
  }
};

test('without Always access, leaving the app stops tracking', async () => {
  const f = backgroundFixture({ permission: 'denied' });
  await f.service.enterForeground();
  await settle();
  await f.service.enterBackground();
  assert.equal(f.state().status, 'idle');
  assert.deepEqual(f.log, ['stop'].slice(0, f.log.length));
});

test('with Always access, tracking continues at low power in the background', async () => {
  const f = backgroundFixture();
  await f.service.enterForeground();
  await settle();
  await f.service.enterBackground();
  assert.equal(f.state().status, 'watching');
  assert.deepEqual(f.log, ['start:balanced']);
  assert.ok(f.watches.every((watch) => watch.removed));
});

test('driving starts the background service while the app is still open', async () => {
  const f = backgroundFixture();
  await f.service.enterForeground();
  await settle();
  await driveTo(f);
  assert.equal(f.state().drivingState, 'driving');
  assert.deepEqual(f.log, ['start:navigation']);
});

test('a background fix keeps the driving state moving', async () => {
  const f = backgroundFixture();
  await f.service.enterForeground();
  await settle();
  await f.service.enterBackground();
  for (let t = 1; t <= 6; t += 1) {
    f.background.onLocation(reading(t * 1000, 25));
    await settle();
  }
  assert.equal(f.state().drivingState, 'driving');
  assert.deepEqual(f.log, ['start:balanced', 'start:navigation']);
  assert.equal(f.state().fix.speedKmh, 90);
});

test('coming back ends the low-power service, and stopping ends it entirely', async () => {
  const f = backgroundFixture();
  await f.service.enterForeground();
  await settle();
  await f.service.enterBackground();
  await f.service.enterForeground();
  await settle();
  assert.equal(f.state().status, 'watching');
  assert.deepEqual(f.log, ['start:balanced', 'stop']);
});

test('a failed background start falls back to stopping', async () => {
  const f = backgroundFixture();
  f.background.start = async () => { throw new Error('not allowed'); };
  await f.service.enterForeground();
  await settle();
  await f.service.enterBackground();
  assert.equal(f.state().status, 'idle');
});

test('a device without background support reports it as unavailable', async () => {
  const f = backgroundFixture();
  f.background.available = async () => false;
  await f.service.start();
  assert.equal(f.state().background, 'unavailable');
});

test('Always access is requested through the service', async () => {
  const f = backgroundFixture({ permission: 'undetermined' });
  await f.service.start();
  assert.equal(f.state().background, 'undetermined');
  await f.service.requestBackgroundPermission();
  assert.equal(f.state().background, 'granted');
  assert.equal(f.state().requesting, false);
});
