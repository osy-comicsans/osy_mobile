const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(result.outputText, filename);
};
const { StartupCoordinator, STARTUP_TIMEOUT_MS, isEmergencyPath } = require('../src/common/lib/startup/startupCoordinator.ts');
const { SplashBrand } = require('../src/common/lib/startup/brand.ts');
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(t, initialPath) {
  const fonts = deferred();
  const session = deferred();
  const direction = deferred();
  const coordinator = new StartupCoordinator({ fonts: () => fonts.promise, session: () => session.promise, direction: () => direction.promise }, initialPath);
  t.after(() => coordinator.stop());
  coordinator.start();
  return { coordinator, fonts, session, direction };
}

test('startup waits for restored auth, fonts, artwork, and content layout', async (t) => {
  const f = fixture(t);
  f.fonts.resolve();
  f.direction.resolve();
  f.coordinator.markContentReady();
  f.coordinator.markArtworkReady();
  await flush();
  assert.equal(f.coordinator.getSnapshot().ready, false, 'fonts alone must not dismiss startup');
  f.session.resolve();
  await flush();
  assert.equal(f.coordinator.getSnapshot().ready, true);
});

test('settled work cannot reveal a blank, unlaid-out first screen', async (t) => {
  const f = fixture(t);
  f.fonts.resolve(); f.session.resolve(); f.direction.resolve();
  f.coordinator.markArtworkReady();
  await flush();
  assert.equal(f.coordinator.getSnapshot().ready, false);
  f.coordinator.markContentReady();
  assert.equal(f.coordinator.getSnapshot().ready, true);
});

test('font and session failures release startup with failed task status for fallback fonts', async (t) => {
  const f = fixture(t);
  f.coordinator.markContentReady(); f.coordinator.markArtworkReady();
  f.fonts.reject(new Error('Font could not load'));
  f.session.reject(new Error('Keychain unavailable'));
  f.direction.resolve();
  await flush();
  const state = f.coordinator.getSnapshot();
  assert.equal(state.ready, true);
  assert.equal(state.tasks.fonts, 'failed');
  assert.equal(state.tasks.session, 'failed');
});

test('a stalled task, direction reload, or image cannot leave startup open forever', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  f.coordinator.markContentReady();
  assert.equal(f.coordinator.getSnapshot().ready, false);
  t.mock.timers.tick(STARTUP_TIMEOUT_MS);
  assert.equal(f.coordinator.getSnapshot().ready, true);
  assert.equal(f.coordinator.getSnapshot().timedOut, true);
});

test('a cold check-in deep link bypasses pending auth, fonts, and artwork after layout', (t) => {
  const f = fixture(t, 'osymobile://check-in?alertId=7');
  assert.equal(f.coordinator.getSnapshot().emergency, true);
  f.coordinator.markContentReady();
  const state = f.coordinator.getSnapshot();
  assert.equal(state.ready, true);
  assert.equal(state.tasks.fonts, 'pending');
  assert.equal(state.tasks.session, 'pending');
  assert.equal(state.artworkReady, false);
});

test('a check-in link arriving during startup releases the gate and readiness never re-blocks', (t) => {
  const f = fixture(t);
  f.coordinator.markContentReady();
  f.coordinator.prioritizeEmergency('/check-in');
  assert.equal(f.coordinator.getSnapshot().ready, true);
  f.coordinator.prioritizeEmergency('/');
  f.coordinator.markArtworkReady();
  assert.equal(f.coordinator.getSnapshot().ready, true);
});

test('emergency matching handles native, web, and Expo Go links without query-string false positives', () => {
  for (const value of ['/check-in', '/check-in/?id=1', 'osymobile://check-in', 'https://osy.test/check-in#response', 'exp://127.0.0.1:8081/--/check-in', '/%63heck-in']) assert.equal(isEmergencyPath(value), true, value);
  for (const value of ['/', '/profile?next=/check-in', '/not-check-in', '/check-in/other', '/%ZZ', null]) assert.equal(isEmergencyPath(value), false, value);
});

test('StrictMode restart reuses startup work and ignores unmounted promise completions', async (t) => {
  const task = deferred();
  let calls = 0;
  const work = () => { calls++; return task.promise; };
  const coordinator = new StartupCoordinator({ fonts: work, session: work, direction: work });
  t.after(() => coordinator.stop());
  coordinator.start();
  await flush();
  coordinator.stop();
  task.resolve();
  await flush();
  assert.equal(coordinator.getSnapshot().tasks.fonts, 'pending');
  coordinator.start();
  coordinator.markContentReady(); coordinator.markArtworkReady();
  await flush();
  assert.equal(calls, 3, 'each task runs once, not once per effect mount');
  assert.equal(coordinator.getSnapshot().ready, true);
});

test('native light/dark splash settings and JS handoff share the same artwork size and palette', () => {
  const { expo } = require('../app.json');
  const [, config] = expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen');
  assert.equal(expo.userInterfaceStyle, 'automatic');
  assert.equal(config.backgroundColor, SplashBrand.light.background);
  assert.equal(config.dark.backgroundColor, SplashBrand.dark.background);
  assert.equal(config.imageWidth, SplashBrand.imageSize);
  for (const variant of [config.image, config.dark.image]) {
    const buffer = fs.readFileSync(path.join(__dirname, '..', variant));
    assert.equal(buffer.readUInt32BE(16), 1024);
    assert.equal(buffer.readUInt32BE(20), 1024);
    assert.equal(buffer[25], 6, 'RGBA preserves transparent Android safe-zone padding');
  }
});
