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

const { CHECK_IN_ROUNDS_SECONDS, createCheckInService } = require('../src/features/safety/utils/checkInService.ts');

const crash = { detectedAt: 1, confidence: 0.9, snapshot: {} };

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const f = { escalations: [], reminders: 0, advance: (seconds) => t.mock.timers.tick(seconds * 1000) };
  f.service = createCheckInService({
    escalate: (trigger, event) => f.escalations.push({ trigger, event }),
    remind: () => { f.reminders += 1; },
  });
  f.state = () => f.service.store.getState();
  return f;
}

test('the rounds are 30, 60, then 90 seconds', () => {
  assert.deepEqual(CHECK_IN_ROUNDS_SECONDS, [30, 60, 90]);
});

test('silence escalates only after all three rounds', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  f.advance(29);
  assert.equal(f.state().round, 0);
  f.advance(1);
  assert.equal(f.state().round, 1);
  assert.equal(f.reminders, 1);
  f.advance(60);
  assert.equal(f.state().round, 2);
  assert.equal(f.reminders, 2);
  f.advance(89);
  assert.deepEqual(f.escalations, []);
  f.advance(1);
  assert.deepEqual(f.escalations, [{ trigger: 'check_in_timeout', event: crash }]);
  assert.equal(f.state().status, 'escalated');
});

test('I am OK cancels, in any round', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  f.advance(40);
  f.service.confirmOk();
  f.advance(300);
  assert.deepEqual(f.escalations, []);
  assert.equal(f.state().status, 'confirmed');
});

test('a new crash starts a check-in after an I am OK', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  f.service.confirmOk();
  f.service.begin(crash);
  assert.equal(f.state().status, 'waiting');
  assert.equal(f.state().round, 0);
});

test('I need help escalates at once, one time only', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  f.service.needHelp();
  f.service.needHelp();
  f.advance(300);
  assert.deepEqual(f.escalations, [{ trigger: 'user_requested', event: crash }]);
});

test('I need help works with no check-in running', (t) => {
  const f = fixture(t);
  f.service.needHelp();
  assert.equal(f.escalations.length, 1);
  assert.equal(f.state().status, 'escalated');
});

test('a second crash does not restart the countdown', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  f.advance(20);
  const { endsAt } = f.state();
  f.service.begin({ ...crash, detectedAt: 2 });
  assert.equal(f.state().endsAt, endsAt);
  assert.equal(f.state().event, crash);
});

test('opening the screen during a check-in keeps its crash', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  f.service.begin();
  assert.equal(f.state().event, crash);
});

test('an escalated check-in stays escalated until the driver answers', (t) => {
  const f = fixture(t);
  f.service.needHelp();
  f.service.begin(crash);
  assert.equal(f.state().status, 'escalated');
  f.service.confirmOk();
  f.service.begin(crash);
  assert.equal(f.state().status, 'waiting');
});

test('returning to the app catches up on missed rounds', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  t.mock.timers.setTime(Date.now() + 100_000);
  f.service.sync();
  assert.equal(f.state().round, 2);
  assert.equal(f.reminders, 1);
  assert.deepEqual(f.escalations, []);
});

test('returning after all rounds passed escalates', (t) => {
  const f = fixture(t);
  f.service.begin(crash);
  t.mock.timers.setTime(Date.now() + 181_000);
  f.service.sync();
  assert.equal(f.escalations[0].trigger, 'check_in_timeout');
});
