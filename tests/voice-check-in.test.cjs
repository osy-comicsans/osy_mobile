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
const { matchIntent } = require('../src/features/safety/utils/voiceIntent.ts');
const { createVoiceCheckIn } = require('../src/features/safety/utils/voiceCheckIn.ts');

// Long enough for the zero-delay restart timer to run first.
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

test('understands "I am OK" and "help" in English, French, and Arabic', () => {
  for (const reply of ["I'm OK", 'I am okay', "I'm fine", 'Cancel', 'Je vais bien', 'ça va', 'Annuler', 'أنا بخير', 'راني لاباس']) {
    assert.equal(matchIntent([reply]), 'ok', reply);
  }
  for (const reply of ['Help', 'Help me', 'I need help', 'Au secours', 'Aidez-moi', "J'ai besoin d'aide", 'النجدة', 'ساعدني', 'أحتاج إلى مساعدة']) {
    assert.equal(matchIntent([reply]), 'help', reply);
  }
});

test('ignores case, punctuation, accents, and Arabic spelling variants', () => {
  assert.equal(matchIntent(['  I’M OK!! ']), 'ok');
  assert.equal(matchIntent(['CA VA.']), 'ok');
  assert.equal(matchIntent(['انا بخير']), 'ok');
  assert.equal(matchIntent(['أَنَا بِخَيْرٍ']), 'ok');
});

test('"not OK" asks for help', () => {
  assert.equal(matchIntent(["I'm not OK"]), 'help');
  assert.equal(matchIntent(['ça va pas']), 'help');
  assert.equal(matchIntent(['je ne vais pas bien']), 'help');
  assert.equal(matchIntent(['لست بخير']), 'help');
});

test('help wins when a reply or its alternatives carry both', () => {
  assert.equal(matchIntent(['ok help']), 'help');
  assert.equal(matchIntent(["I'm OK", 'help']), 'help');
});

test('long speech and unrelated words are not answers', () => {
  assert.equal(matchIntent(['the weather is okay and I am fine with the traffic on the road today']), null);
  assert.equal(matchIntent(['turn left in two hundred metres']), null);
  assert.equal(matchIntent(['okay']), null);
  assert.equal(matchIntent(['']), null);
  assert.equal(matchIntent([]), null);
});

function fixture({ available = true, permission = true } = {}) {
  const calls = { speak: [], listen: [], stopListening: 0, stopSpeaking: 0, permissionRequests: 0 };
  let listener = null;
  let speechDone = null;
  const driver = {
    available: () => available,
    requestPermission: async () => { calls.permissionRequests += 1; return permission; },
    speak: (text, language, onDone) => { calls.speak.push({ text, language }); speechDone = onDone; },
    stopSpeaking: () => { calls.stopSpeaking += 1; },
    listen: (language, phrases, handlers) => { calls.listen.push({ language, phrases }); listener = handlers; },
    stopListening: () => { calls.stopListening += 1; },
  };
  const intents = [];
  const voice = createVoiceCheckIn({ driver, onIntent: (intent) => intents.push(intent), restartDelayMs: 0 });
  return {
    voice,
    calls,
    intents,
    state: () => voice.store.getState(),
    finishSpeaking: () => speechDone(),
    heard: (transcripts, isFinal = true) => listener.onResult(transcripts, isFinal),
    level: (value) => listener.onLevel(value),
    error: (code) => { listener.onError(code); listener.onEnd(); },
    end: () => listener.onEnd(),
  };
}

test('asks out loud, then listens', async () => {
  const f = fixture();
  await f.voice.prompt('fr', 'Tout va bien ?');
  assert.deepEqual(f.calls.speak, [{ text: 'Tout va bien ?', language: 'fr' }]);
  assert.equal(f.state().status, 'speaking');
  assert.equal(f.calls.listen.length, 0);

  f.finishSpeaking();
  assert.equal(f.state().status, 'listening');
  assert.equal(f.calls.listen[0].language, 'fr');
  assert.ok(f.calls.listen[0].phrases.includes('Je vais bien'));
});

test('listens without asking when there is nothing to say', async () => {
  const f = fixture();
  await f.voice.prompt('ar', null);
  assert.equal(f.calls.speak.length, 0);
  assert.equal(f.state().status, 'listening');
  assert.equal(f.calls.listen[0].language, 'ar');
});

test('a final "I am OK" answers once and stops listening', async () => {
  const f = fixture();
  await f.voice.prompt('en', 'Are you OK?');
  f.finishSpeaking();
  f.heard(["I'm OK"], false);
  assert.deepEqual(f.intents, []);
  f.heard(["I'm OK"]);
  assert.deepEqual(f.intents, ['ok']);
  assert.equal(f.state().status, 'off');
  assert.ok(f.calls.stopListening > 0);
  f.heard(['help']);
  assert.deepEqual(f.intents, ['ok']);
});

test('keeps listening through silence, noise, and other words', async () => {
  const f = fixture();
  await f.voice.prompt('en', 'Are you OK?');
  f.finishSpeaking();
  f.heard(['what happened']);
  f.end();
  await settle();
  f.error('no-speech');
  await settle();
  assert.equal(f.calls.listen.length, 3);
  assert.equal(f.state().status, 'listening');
  f.heard(['help']);
  assert.deepEqual(f.intents, ['help']);
});

test('reports the input level while listening', async () => {
  const f = fixture();
  await f.voice.prompt('en', 'Are you OK?');
  f.finishSpeaking();
  f.level(5);
  assert.equal(f.state().level, 0.5);
  f.level(-2);
  assert.equal(f.state().level, 0);
  f.level(14);
  assert.equal(f.state().level, 1);
});

test('falls back to touch when voice is unavailable or the microphone is refused', async () => {
  const unavailable = fixture({ available: false });
  await unavailable.voice.prompt('en', 'Are you OK?');
  assert.equal(unavailable.state().status, 'unavailable');
  assert.equal(unavailable.calls.permissionRequests, 0);
  assert.equal(unavailable.calls.speak.length, 0);

  const denied = fixture({ permission: false });
  await denied.voice.prompt('en', 'Are you OK?');
  assert.equal(denied.state().status, 'denied');
  assert.equal(denied.calls.speak.length, 0);
  await denied.voice.prompt('en', 'Are you OK?');
  assert.equal(denied.calls.permissionRequests, 1);
});

test('a refused microphone or a missing recognizer stops listening', async () => {
  const f = fixture();
  await f.voice.prompt('en', 'Are you OK?');
  f.finishSpeaking();
  f.error('not-allowed');
  await settle();
  assert.equal(f.state().status, 'denied');
  assert.equal(f.calls.listen.length, 1);

  const g = fixture();
  await g.voice.prompt('en', 'Are you OK?');
  g.finishSpeaking();
  g.error('language-not-supported');
  await settle();
  assert.equal(g.state().status, 'unavailable');
});

test('asking again replaces the current question', async () => {
  const f = fixture();
  await f.voice.prompt('en', 'Are you OK?');
  f.finishSpeaking();
  const stale = f.heard;
  await f.voice.prompt('en', "If you're OK, say I'm OK.");
  assert.equal(f.calls.speak.length, 2);
  assert.equal(f.state().status, 'speaking');
  assert.ok(f.calls.stopListening > 0);
  stale(["I'm OK"]);
  assert.deepEqual(f.intents, []);
});

test('stop ends speech and listening, and late events do nothing', async () => {
  const f = fixture();
  await f.voice.prompt('en', 'Are you OK?');
  f.voice.stop();
  assert.equal(f.state().status, 'off');
  f.finishSpeaking();
  assert.equal(f.calls.listen.length, 0);
});
