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

const { ALERT_RULES, parseAlert, toAlertData, usesHaptics, usesSound } = require('../src/features/alerts/utils/alertRules.ts');
const { createAlertService } = require('../src/features/alerts/utils/alertService.ts');
const { defaultSettings } = require('../src/features/settings/types/settings.types.ts');

const crash = { alertId: 'c1', alertType: 'crash_detected' };
const risk = { alertId: 'r1', alertType: 'potential_accident' };
const nearby = { alertId: 'n1', alertType: 'accident_nearby', roadName: 'RN 5', distanceMeters: '850' };

function fixture(overrides = {}, options = {}) {
  const f = {
    time: 1_000_000, navigated: [], haptics: [], tokens: [], answers: [], handler: null,
    listeners: {}, removed: 0, presented: [], permission: 'granted', token: { token: 't1', platform: 'android' },
  };
  const driver = {
    supported: true,
    setUp: async (_channels, shouldPlaySound) => { f.shouldPlaySound = shouldPlaySound; },
    getPermission: async () => ({ permission: f.permission, canAskAgain: true }),
    requestPermission: async () => ({ permission: 'granted', canAskAgain: true }),
    getPushToken: async () => f.token,
    onReceived(listener) { f.listeners.received = listener; return { remove: () => { f.removed += 1; } }; },
    onOpened(listener) { f.listeners.opened = listener; return { remove: () => { f.removed += 1; } }; },
    present: async (alert) => { f.presented.push(alert.id); },
    playHaptic: async (severity) => { f.haptics.push(severity); },
    ...overrides,
  };
  f.service = createAlertService({
    driver,
    navigate: (alert) => f.navigated.push(alert.id),
    onCheckInAnswer: (action) => f.answers.push(action),
    sendPushToken: async (token) => {
      if (f.pushFails) throw new Error('offline');
      f.tokens.push(token);
    },
    now: () => f.time,
    ...options,
  });
  f.stop = f.service.start([]);
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

test('a road warning is spoken once, with its reason, and only with voice on', () => {
  const settings = { ...defaultSettings, voice: true };
  const spoken = [];
  const f = fixture({}, { getSettings: () => settings, speak: (alert) => spoken.push(alert.detail) });
  const warning = { id: 'w1', type: 'potential_accident', detail: 'Sharp curves. Slow down.' };
  f.service.raise(warning, { title: '', body: '' });
  f.service.raise(warning, { title: '', body: '' });
  f.time += ALERT_RULES.potential_accident.minInterval;
  settings.voice = false;
  f.service.raise({ ...warning, id: 'w2' }, { title: '', body: '' });
  assert.deepEqual(spoken, ['Sharp curves. Slow down.']);
  assert.equal(f.banner().id, 'w2');
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
  await assert.rejects(f.service.registerPushToken('fr'));
  f.pushFails = false;
  await f.service.registerPushToken('fr');
  await f.service.registerPushToken('fr');
  assert.deepEqual(f.tokens, [{ token: 't1', platform: 'android', language: 'fr' }]);
});

test('a language change is sent to the server', async () => {
  const f = fixture();
  await new Promise(setImmediate);
  await f.service.registerPushToken('fr');
  await f.service.registerPushToken('ar');
  assert.deepEqual(f.tokens.map((token) => token.language), ['fr', 'ar']);
});

test('nothing is sent until a token exists', async () => {
  const f = fixture();
  f.token = null;
  await new Promise(setImmediate);
  await f.service.registerPushToken('en');
  assert.deepEqual(f.tokens, []);
});

test('no token is sent without permission', async () => {
  const f = fixture({ getPermission: async () => ({ permission: 'denied', canAskAgain: true }) });
  await new Promise(setImmediate);
  await f.service.registerPushToken('en');
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

test('a raised crash reacts at once and still gets its sound', async () => {
  const f = fixture();
  await new Promise(setImmediate);
  f.service.raise({ id: 'c9', type: 'crash_detected' }, { title: 'T', body: 'B' });
  assert.deepEqual(f.navigated, ['c9']);
  assert.deepEqual(f.haptics, ['critical']);
  assert.deepEqual(f.presented, ['c9']);
  const data = { alertId: 'c9', alertType: 'crash_detected' };
  assert.equal(f.shouldPlaySound(data), true);
  assert.equal(f.shouldPlaySound(data), false);
  f.listeners.received(data);
  assert.equal(f.navigated.length, 1);
});

test('I am OK from a notification answers without opening the screen', () => {
  const f = fixture();
  f.listeners.opened(crash, 'im_ok');
  assert.deepEqual(f.answers, ['im_ok']);
  assert.deepEqual(f.navigated, []);
});

test('I need help from a notification answers and opens the screen', () => {
  const f = fixture();
  f.listeners.opened(crash, 'need_help');
  assert.deepEqual(f.answers, ['need_help']);
  assert.deepEqual(f.navigated, ['c1']);
});

test('tapping the notification itself gives no answer', () => {
  const f = fixture();
  f.listeners.opened(crash, 'expo.modules.notifications.actions.DEFAULT');
  assert.deepEqual(f.answers, []);
  assert.deepEqual(f.navigated, ['c1']);
});
