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

const { ALERT_RULES, ALERT_TYPES, parseAlert, toAlertData, usesHaptics, usesSound } = require('../src/features/alerts/utils/alertRules.ts');
const { createAlertService } = require('../src/features/alerts/utils/alertService.ts');

const crash = { alertId: 'c1', alertType: 'crash_detected' };
const risk = { alertId: 'r1', alertType: 'potential_accident' };
const nearby = { alertId: 'n1', alertType: 'accident_nearby', roadName: 'RN 5', distanceMeters: '850' };

function fixture(overrides = {}) {
  const f = {
    time: 1_000_000, navigated: [], haptics: [], tokens: [], handler: null,
    listeners: {}, removed: 0, permission: 'granted', token: { token: 't1', platform: 'android' },
  };
  const driver = {
    supported: true,
    setUp: async (_channels, _label, shouldPlaySound) => { f.shouldPlaySound = shouldPlaySound; },
    getPermission: async () => ({ permission: f.permission, canAskAgain: true }),
    requestPermission: async () => ({ permission: 'granted', canAskAgain: true }),
    getPushToken: async () => f.token,
    onReceived(listener) { f.listeners.received = listener; return { remove: () => { f.removed += 1; } }; },
    onOpened(listener) { f.listeners.opened = listener; return { remove: () => { f.removed += 1; } }; },
    present: async () => undefined,
    playHaptic: async (severity) => { f.haptics.push(severity); },
    ...overrides,
  };
  f.service = createAlertService({
    driver,
    navigate: (alert) => f.navigated.push(alert.id),
    sendPushToken: async (token) => {
      if (f.pushFails) throw new Error('offline');
      f.tokens.push(token);
    },
    now: () => f.time,
  });
  f.stop = f.service.start([], 'View');
  f.banner = () => f.service.store.getState().banner;
  return f;
}

test('alerts parse from Android data, iOS body, and JSON text', () => {
  const expected = { id: 'n1', type: 'accident_nearby', roadName: 'RN 5', distanceMeters: 850 };
  assert.deepEqual(parseAlert(nearby), expected);
  assert.deepEqual(parseAlert({ body: nearby }), expected);
  assert.deepEqual(parseAlert({ body: JSON.stringify(nearby) }), expected);
});

test('other notifications and bad values are ignored', () => {
  for (const data of [null, {}, { body: 'not json' }, { alertId: 'x', alertType: 'unknown' }, { alertType: 'crash_detected' }]) {
    assert.equal(parseAlert(data), null);
  }
});

test('alert data survives a round trip', () => {
  const alert = { id: 'a', type: 'accident_nearby', roadName: 'RN 5', distanceMeters: 0 };
  assert.deepEqual(parseAlert(toAlertData(alert)), alert);
});

test('a crash opens the full-screen check-in with no banner', () => {
  const f = fixture();
  f.listeners.received(crash);
  assert.deepEqual(f.navigated, ['c1']);
  assert.equal(f.banner(), null);
  assert.deepEqual(f.haptics, ['critical']);
});

test('other alerts show a banner that clears itself', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.listeners.received(risk);
  assert.equal(f.banner().id, 'r1');
  assert.deepEqual(f.navigated, []);
  assert.deepEqual(f.haptics, ['warning']);
  t.mock.timers.tick(ALERT_RULES.potential_accident.bannerDuration);
  assert.equal(f.banner(), null);
});

test('a repeated alert id is shown once', () => {
  const f = fixture();
  f.listeners.received(crash);
  f.listeners.received(crash);
  assert.equal(f.navigated.length, 1);
  assert.equal(f.haptics.length, 1);
});

test('non-crash alerts are rate limited by type', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.listeners.received(nearby);
  f.service.dismissBanner();
  f.listeners.received({ ...nearby, alertId: 'n2' });
  assert.equal(f.banner(), null);
  f.listeners.received(risk);
  assert.equal(f.banner().id, 'r1');
  f.service.dismissBanner();
  f.time += ALERT_RULES.accident_nearby.minInterval;
  f.listeners.received({ ...nearby, alertId: 'n3' });
  assert.equal(f.banner().id, 'n3');
});

test('different crashes are never rate limited', () => {
  const f = fixture();
  f.listeners.received(crash);
  f.listeners.received({ ...crash, alertId: 'c2' });
  assert.deepEqual(f.navigated, ['c1', 'c2']);
});

test('tapping a notification opens it even if it was already shown', () => {
  const f = fixture();
  f.listeners.received(nearby);
  f.listeners.opened(nearby);
  assert.deepEqual(f.navigated, ['n1']);
  assert.equal(f.banner(), null);
  assert.equal(f.service.getAlert('n1').roadName, 'RN 5');
});

test('an opened alert is not announced again', () => {
  const f = fixture();
  f.listeners.opened(crash);
  f.listeners.received(crash);
  assert.equal(f.navigated.length, 1);
  assert.deepEqual(f.haptics, []);
});

test('settings silence alerts, except crashes', () => {
  const off = { sound: false, haptics: false };
  assert.equal(usesSound('accident_nearby', off), false);
  assert.equal(usesHaptics('potential_accident', off), false);
  assert.equal(usesSound('crash_detected', off), true);
  assert.equal(usesHaptics('crash_detected', off), true);
});

test('muted haptics and sound apply to live alerts', async () => {
  const f = fixture();
  await Promise.resolve();
  f.service.store.setState({ preferences: { sound: false, haptics: false } });
  assert.equal(f.shouldPlaySound(risk), false);
  assert.equal(f.shouldPlaySound(crash), true);
  assert.equal(f.shouldPlaySound({ other: true }), false);
  f.listeners.received(risk);
  assert.deepEqual(f.haptics, []);
  f.service.dismissBanner();
});

test('a duplicate plays no sound', () => {
  const f = fixture();
  assert.equal(f.shouldPlaySound(crash), true);
  f.listeners.received(crash);
  assert.equal(f.shouldPlaySound(crash), false);
});

test('the push token is sent once, and retried after a failure', async () => {
  const f = fixture();
  await new Promise(setImmediate);
  f.pushFails = true;
  await assert.rejects(f.service.registerPushToken());
  f.pushFails = false;
  await f.service.registerPushToken();
  await f.service.registerPushToken();
  assert.deepEqual(f.tokens, [{ token: 't1', platform: 'android' }]);
});

test('no token is sent without permission', async () => {
  const f = fixture({ getPermission: async () => ({ permission: 'denied', canAskAgain: true }) });
  await new Promise(setImmediate);
  await f.service.registerPushToken();
  assert.deepEqual(f.tokens, []);
});

test('a permission request updates the state', async () => {
  const f = fixture({ getPermission: async () => ({ permission: 'undetermined', canAskAgain: true }) });
  await new Promise(setImmediate);
  await f.service.requestPermission();
  const state = f.service.store.getState();
  assert.equal(state.permission, 'granted');
  assert.equal(state.requesting, false);
});

test('stopping removes the listeners', () => {
  const f = fixture();
  f.stop();
  assert.equal(f.removed, 2);
});

test('closed-app push text matches the app text in every language', () => {
  const { expo } = require('../app.json');
  for (const [language, file] of Object.entries(expo.locales)) {
    const app = require(`../src/common/lib/i18n/locales/${language}.json`).alerts;
    const native = require(`../${file}`);
    for (const type of ALERT_TYPES) {
      for (const part of ['title', 'body']) {
        const key = `alert_${type}_${part}`;
        assert.equal(native.ios['Localizable.strings'][key], app[type][part], key);
        assert.equal(native.android[key].replace(/\\'/g, "'"), app[type][part], key);
      }
    }
  }
});
