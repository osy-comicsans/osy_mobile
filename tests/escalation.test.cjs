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

const { createEscalationService } = require('../src/features/safety/utils/escalationService.ts');
const { createCheckInService } = require('../src/features/safety/utils/checkInService.ts');
const { createSafetyApi } = require('../src/features/safety/api/safetyApi.ts');
const { createMockBackend } = require('../src/common/lib/api/mock/mockBackend.ts');

const uuid = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const fix = { latitude: 36.7, longitude: 3.1 };
const crash = {
  detectedAt: 1_700_000_000_000,
  confidence: 0.9,
  snapshot: { location: { latitude: 36.8, longitude: 3.2 }, speedBeforeKmh: 72 },
};

function fixture({ place = fix, saved = null, failures = 0 } = {}) {
  const values = new Map(saved ? [['osy.escalation.pending', JSON.stringify(saved)]] : []);
  const calls = [];
  let remaining = failures;
  const call = async (name, value, result) => {
    calls.push({ name, value });
    if (name === 'createIncident' && remaining > 0) {
      remaining -= 1;
      throw new Error('offline');
    }
    return result;
  };
  let id = 0;
  const f = {
    calls, values,
    location: createStore(() => ({ fix: place })),
  };
  f.service = createEscalationService({
    api: {
      createIncident: (request) => call('createIncident', request, {}),
      escalate: (request) => call('escalate', request, { id: request.id, status: 'escalating', liveLocationUrl: 'https://osy.test/live' }),
      shareLocation: (escalationId, location) => call('shareLocation', { escalationId, location }),
      cancelEscalation: (escalationId) => call('cancelEscalation', escalationId, {}),
    },
    location: f.location,
    currentRoad: () => ({ name: 'Rocade Nord', refs: ['RN 11', 'CW 1'] }),
    storage: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async (key) => { values.delete(key); },
    },
    createId: () => { id += 1; return uuid(id); },
    now: () => 1_700_000_500_000,
  });
  f.state = () => f.service.store.getState();
  f.named = (name) => calls.filter((entry) => entry.name === name);
  return f;
}

test('a crash sends its location, speed, and road', async () => {
  const f = fixture();
  await f.service.start('check_in_timeout', crash);
  const [{ value: incident }] = f.named('createIncident');
  const [{ value: request }] = f.named('escalate');
  assert.equal(incident.source, 'crash_detected');
  assert.equal(incident.type, 'crash');
  assert.equal(incident.occurredAt, new Date(crash.detectedAt).toISOString());
  assert.deepEqual(request.location, { latitude: 36.8, longitude: 3.2 });
  assert.equal(request.incidentId, incident.id);
  assert.equal(request.trigger, 'check_in_timeout');
  assert.equal(request.speedBeforeImpactKmh, 72);
  assert.equal(request.roadName, 'Rocade Nord');
  assert.equal(request.roadNumber, 'RN 11');
  assert.equal(request.shareMedicalInfo, false);
  assert.equal(f.state().status, 'sent');
  assert.equal(f.state().liveLocationUrl, 'https://osy.test/live');
  f.service.stop();
});

test('without a crash it uses the current location', async () => {
  const f = fixture();
  await f.service.start('user_requested', null);
  assert.deepEqual(f.named('escalate')[0].value.location, fix);
  const [{ value: incident }] = f.named('createIncident');
  assert.equal(incident.source, 'user_report');
  // The contract has no crash type for user reports, and history would show an unknown type as Other.
  assert.equal(incident.type, 'other');
  f.service.stop();
});

test('no location at all sends nothing and says so', async () => {
  const f = fixture({ place: null });
  await f.service.start('user_requested', null);
  assert.equal(f.state().status, 'noLocation');
  assert.deepEqual(f.calls, []);
});

test('a second start does not send twice', async () => {
  const f = fixture();
  await f.service.start('user_requested', null);
  await f.service.start('check_in_timeout', null);
  assert.equal(f.named('escalate').length, 1);
  f.service.stop();
});

test('offline it retries with the same ids', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = fixture({ failures: 1 });
  await f.service.start('user_requested', null);
  assert.equal(f.state().status, 'waitingForSignal');
  t.mock.timers.tick(15_000);
  for (let i = 0; i < 6; i += 1) await new Promise(process.nextTick);
  await Promise.resolve();
  assert.equal(f.state().status, 'sent');
  const ids = f.named('createIncident').map(({ value }) => value.id);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  f.service.stop();
});

test('an unsent request survives a restart and goes out', async () => {
  const offline = fixture({ failures: 5 });
  await offline.service.start('user_requested', null);
  offline.service.stop();
  const saved = JSON.parse(offline.values.get('osy.escalation.pending'));

  const f = fixture({ saved });
  await f.service.restore();
  assert.equal(f.state().status, 'sent');
  assert.equal(f.named('escalate')[0].value.id, saved.escalation.id);
  f.service.stop();
});

test('location keeps being shared until it is canceled', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = fixture();
  await f.service.start('user_requested', null);
  t.mock.timers.tick(30_000);
  t.mock.timers.tick(30_000);
  assert.equal(f.named('shareLocation').length, 2);
  await f.service.cancel();
  t.mock.timers.tick(90_000);
  assert.equal(f.named('shareLocation').length, 2);
});

test('canceling a sent request tells the server', async () => {
  const f = fixture();
  await f.service.start('user_requested', null);
  await f.service.cancel();
  assert.equal(f.state().status, 'canceled');
  assert.equal(f.named('cancelEscalation').length, 1);
  assert.equal(f.values.has('osy.escalation.pending'), false);
});

test('canceling an unsent request stops it going out', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture({ failures: 1 });
  await f.service.start('user_requested', null);
  await f.service.cancel();
  t.mock.timers.tick(60_000);
  await new Promise(process.nextTick);
  assert.equal(f.named('escalate').length, 0);
  assert.equal(f.named('cancelEscalation').length, 0);
});

test('the audit trail records each step', async () => {
  const f = fixture();
  await f.service.start('user_requested', null);
  await f.service.cancel();
  assert.deepEqual(f.state().audit.map(({ action }) => action), ['requested', 'sent', 'canceled']);
});

test('I am OK after escalating cancels the request', () => {
  const canceled = [];
  const service = createCheckInService({
    escalate: () => undefined, remind: () => undefined, cancelEscalation: () => canceled.push(true),
  });
  service.begin();
  service.confirmOk();
  assert.equal(canceled.length, 0);
  service.needHelp();
  service.confirmOk();
  assert.equal(canceled.length, 1);
});

test('the mock accepts the whole flow through the real API', async () => {
  const values = new Map();
  const adapter = createMockBackend({ getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }, 0);
  const client = create({ baseURL: 'https://mock.test', adapter, headers: { Authorization: 'Bearer mock-access.mock-taken' } });
  const api = createSafetyApi(client);
  const location = { latitude: 36.7, longitude: 3.1 };
  await api.createIncident({
    id: uuid(1), source: 'crash_detected', location, occurredAt: '2026-10-30T10:00:00+01:00',
    type: 'crash', severity: 'serious', injuriesVisible: null, note: null,
  });
  const sent = await api.escalate({
    id: uuid(2), incidentId: uuid(1), trigger: 'user_requested', location,
    speedBeforeImpactKmh: null, roadName: null, roadNumber: null, shareMedicalInfo: false,
  });
  assert.equal(sent.status, 'escalating');
  await api.shareLocation(uuid(2), location);
  assert.equal((await api.cancelEscalation(uuid(2))).status, 'canceled');
});
