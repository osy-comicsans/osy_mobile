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

const { extractFeatures } = require('../src/features/crash-detection/model/crashFeatures.ts');
const { buildModelWindow, vehicleAxes } = require('../src/features/crash-detection/model/modelWindow.ts');
const { createCrashModelMonitor } = require('../src/features/crash-detection/model/crashModelMonitor.ts');
const { createCrashDetectionService } = require('../src/features/crash-detection/utils/crashDetectionService.ts');
const { createStore } = require('zustand/vanilla');
const expected = require('./fixtures/crash-features.json');

// The same signals that produced the fixture from the training notebook's extract().
function signal(kind) {
  const acceleration = new Float32Array(4800);
  const rotation = new Float32Array(4800);
  for (let i = 0; i < 1600; i += 1) {
    const t = i / 100;
    acceleration.set([0.05 * Math.sin(t * 2.3), 0.04 * Math.cos(t * 1.7), 1 + 0.03 * Math.sin(t * 3.1)], i * 3);
    rotation.set([2 * Math.sin(t * 0.9), 3 * Math.cos(t * 1.3), 4 * Math.sin(t * 0.7)], i * 3);
    if (kind === 'impact') {
      const pulse = Math.exp(-(((t - 8) / 0.06) ** 2));
      acceleration[i * 3] = Math.fround(0.05 * Math.sin(t * 2.3) - 6 * pulse);
      acceleration[i * 3 + 1] = Math.fround(0.04 * Math.cos(t * 1.7) + 2 * pulse);
      rotation[i * 3 + 2] = Math.fround(4 * Math.sin(t * 0.7) + 120 * Math.exp(-(((t - 8.2) / 0.15) ** 2)));
    }
  }
  const speed = Float32Array.from({ length: 16 }, (_, second) => {
    if (kind === 'calm') return 60 + 5 * Math.sin(second / 3);
    return second < 8 ? 70 : Math.max(0, 70 - (second - 7) * 25);
  });
  return { acceleration, rotation, speed };
}

for (const kind of ['calm', 'impact']) {
  test(`all 114 features match the training notebook: ${kind}`, () => {
    const features = extractFeatures(signal(kind));
    assert.equal(features.length, 114);
    expected[kind].forEach((value, index) => {
      const tolerance = Math.max(1e-3, Math.abs(value) * 1e-3);
      assert.ok(Math.abs(features[index] - value) <= tolerance, `${expected.names[index]}: ${features[index]} vs ${value}`);
    });
  });
}

const flat = (t, x = 0, y = 0, z = 1) => ({ t, x, y, z });

test('gravity becomes up and a frontal jolt becomes negative forward', () => {
  const samples = [flat(0, 0, 1, 0), flat(1000, 0, 1, 0), { t: 3000, x: 5, y: 1, z: 0 }];
  const { up, forward } = vehicleAxes(samples, 3000);
  assert.deepEqual([up.x, up.y, up.z], [0, 1, 0]);
  assert.ok(forward.x < -0.99);
});

test('a phone at 50 Hz becomes 100 Hz in the vehicle frame, with rotation in deg/s', () => {
  const start = 1_000_000;
  const acceleration = Array.from({ length: 800 }, (_, i) => ({ t: start + i * 20, x: 0, y: 1, z: 0 }));
  const rotation = Array.from({ length: 800 }, (_, i) => ({ t: start + i * 20, x: 0, y: Math.PI, z: 0 }));
  const speeds = [{ t: start, kmh: 40 }, { t: start + 10_000, kmh: 10 }];
  const window = buildModelWindow(acceleration, rotation, speeds, start + 8000);
  assert.equal(window.acceleration.length, 4800);
  assert.ok(Math.abs(window.acceleration[800 * 3 + 2] - 1) < 1e-6);
  assert.ok(Math.abs(window.rotation[800 * 3 + 2] - 180) < 1e-3);
  assert.equal(window.speed[0], 40);
  assert.equal(window.speed[15], 10);
});

function monitorFixture(probabilities) {
  const f = { crashes: [], nearMisses: [], calls: 0 };
  f.monitor = createCrashModelMonitor({
    classify: async (features) => { f.calls += 1; f.features = features; return probabilities; },
    onCrash: (event) => f.crashes.push(event),
    onNearMiss: (at, probability) => f.nearMisses.push({ at, probability }),
  });
  f.drive = async (seconds, { speed = 60, impactAt = null } = {}) => {
    f.monitor.addFix({ timestamp: 0, speedKmh: speed, latitude: 36, longitude: 3 });
    for (let i = 0; i < seconds * 50; i += 1) {
      const t = 1_000_000 + i * 20;
      f.monitor.addAcceleration(t === impactAt ? flat(t, 5, 0, 1) : flat(t));
    }
    await new Promise(setImmediate);
  };
  return f;
}

test('ordinary driving never runs the model', async () => {
  const f = monitorFixture({ crash: 1, nearMiss: 0, normal: 0 });
  await f.drive(20);
  assert.equal(f.calls, 0);
});

test('a jolt runs the model 8 seconds later, with a full 114-feature window', async () => {
  const f = monitorFixture({ crash: 0.9, nearMiss: 0.05, normal: 0.05 });
  await f.drive(20, { impactAt: 1_000_000 + 10_000 });
  assert.equal(f.calls, 1);
  assert.equal(f.features.length, 114);
  assert.equal(f.crashes[0].source, 'model');
  assert.equal(f.crashes[0].confidence, 0.9);
  assert.equal(f.crashes[0].snapshot.speedBeforeKmh, 60);
});

test('a jolt while stopped is ignored, like a dropped phone', async () => {
  const f = monitorFixture({ crash: 1, nearMiss: 0, normal: 0 });
  await f.drive(20, { speed: 5, impactAt: 1_000_000 + 10_000 });
  assert.equal(f.calls, 0);
});

test('a near miss is recorded without raising a crash', async () => {
  const f = monitorFixture({ crash: 0.1, nearMiss: 0.8, normal: 0.1 });
  await f.drive(20, { impactAt: 1_000_000 + 10_000 });
  assert.deepEqual(f.crashes, []);
  assert.equal(f.nearMisses[0].probability, 0.8);
});

test('without a runtime nothing happens', async () => {
  const f = monitorFixture(null);
  await f.drive(20, { impactAt: 1_000_000 + 10_000 });
  assert.deepEqual(f.crashes, []);
});

function checkFixture({ classify, available = true, samples = 3 } = {}) {
  const calls = { removed: 0 };
  const driver = {
    available: async () => available,
    subscribe: async (onAcceleration, onRotation) => {
      for (let i = 0; i < samples; i += 1) {
        onAcceleration({ t: 1000 + i * 20, x: 0, y: 0, z: 1 });
        onRotation({ t: 1000 + i * 20, x: 0, y: 0, z: 0 });
      }
      return { remove: () => { calls.removed += 1; } };
    },
  };
  const location = createStore(() => ({ status: 'idle', drivingState: 'stationary', fix: null }));
  const service = createCrashDetectionService(driver, location, () => 1_000_000, classify);
  return { service, calls };
}

async function driveThroughJolt(scores) {
  let handlers;
  const driver = {
    available: async () => true,
    subscribe: async (onAcceleration, onRotation) => {
      handlers = { onAcceleration, onRotation };
      return { remove() {} };
    },
  };
  const fix = { speedKmh: 60, timestamp: 0 };
  const location = createStore(() => ({ status: 'watching', drivingState: 'driving', fix }));
  const service = createCrashDetectionService(driver, location, () => 0, async () => scores);
  const nearMisses = [];
  const crashes = [];
  service.onNearMiss((event) => nearMisses.push(event));
  service.onCrashDetected((event) => crashes.push(event));
  service.start();
  await new Promise(process.nextTick);
  for (let t = 0; t <= 26_000; t += 20) {
    const z = t === 16_000 ? 3 : 1;
    handlers.onAcceleration({ t, x: 0, y: 0, z });
    handlers.onRotation({ t, x: 0, y: 0, z: 0 });
  }
  await new Promise(process.nextTick);
  service.stop();
  return { nearMisses, crashes };
}

test('a near miss warns the listeners, and a crash runs detection instead', async () => {
  const warned = await driveThroughJolt({ crash: 0.1, nearMiss: 0.8, normal: 0.1 });
  assert.equal(warned.nearMisses.length, 1);
  assert.equal(warned.nearMisses[0].probability, 0.8);
  assert.deepEqual(warned.crashes, []);

  const crashed = await driveThroughJolt({ crash: 0.9, nearMiss: 0.05, normal: 0.05 });
  assert.deepEqual(crashed.nearMisses, []);
  assert.equal(crashed.crashes[0].source, 'model');

  const calm = await driveThroughJolt({ crash: 0.1, nearMiss: 0.1, normal: 0.8 });
  assert.deepEqual(calm.nearMisses, []);
  assert.deepEqual(calm.crashes, []);
});

test('the model check reads real sensors without driving, and raises nothing', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let features;
  const { service, calls } = checkFixture({
    classify: async (input) => { features = input; return { crash: 0.1, nearMiss: 0.2, normal: 0.7 }; },
  });
  const crashes = [];
  service.onCrashDetected((event) => crashes.push(event));
  const pending = service.checkModel();
  await new Promise(process.nextTick);
  await Promise.resolve();
  t.mock.timers.tick(17_000);
  const result = await pending;
  assert.equal(result.status, 'done');
  assert.equal(features.length, 114);
  assert.equal(calls.removed, 1);
  assert.deepEqual(crashes, []);
  assert.equal(service.store.getState().lastCrash, null);
});

test('the model check reports a load failure instead of hiding it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { service } = checkFixture({ classify: async () => { throw new Error('bad model'); } });
  const pending = service.checkModel();
  await new Promise(process.nextTick);
  await Promise.resolve();
  t.mock.timers.tick(17_000);
  const result = await pending;
  assert.equal(result.status, 'failed');
  assert.match(result.reason, /bad model/);
});

test('the model check reports a missing runtime and missing sensors', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { service } = checkFixture({ classify: async () => null });
  const pending = service.checkModel();
  await new Promise(process.nextTick);
  await Promise.resolve();
  t.mock.timers.tick(17_000);
  assert.equal((await pending).status, 'noRuntime');
  assert.equal((await checkFixture({ available: false, classify: async () => null }).service.checkModel()).status, 'noSensors');
});

test('the rules still run when the model is missing', () => {
  const service = fs.readFileSync(path.join(__dirname, '../src/features/crash-detection/utils/crashDetectionService.ts'), 'utf8');
  assert.match(service, /const event = detector\.addAcceleration\(sample\);\s+if \(event\) emit\(event\);\s+model\?\.addAcceleration/);
});
