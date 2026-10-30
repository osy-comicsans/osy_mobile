const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { z } = require('zod');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(outputText, filename);
};

const src = path.join(__dirname, '../src');
const { isRtl, resolveLanguage } = require('../src/common/lib/i18n/languages.ts');
const { distanceParts, formatDateTime, formatNumber } = require('../src/common/lib/i18n/format.ts');
const { createArabicTypography, Typography, ArabicFontFamily } = require('../src/common/lib/tokens.ts');
const en = require('../src/common/lib/i18n/locales/en.json');
const fr = require('../src/common/lib/i18n/locales/fr.json');
const ar = require('../src/common/lib/i18n/locales/ar.json');

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => (
    typeof child === 'string' ? [[`${prefix}${key}`, child]] : flatten(child, `${prefix}${key}.`)
  ));
}

const placeholders = (text) => (text.match(/{{\w+}}/g) ?? []).sort();

test('every language has the same keys and placeholders as English', () => {
  const base = new Map(flatten(en));
  for (const locale of [fr, ar]) {
    const entries = new Map(flatten(locale));
    assert.deepEqual([...entries.keys()].sort(), [...base.keys()].sort());
    for (const [key, text] of entries) {
      assert.notEqual(text.trim(), '', key);
      assert.deepEqual(placeholders(text), placeholders(base.get(key)), key);
    }
  }
});

test('Arabic translations are written in Arabic', () => {
  for (const [key, text] of flatten(ar)) assert.match(text, /[\u0600-\u06FF]/, key);
});

test('the app config lists every language with permission text', () => {
  const { expo } = require('../app.json');
  const plugin = expo.plugins.find((entry) => entry[0] === 'expo-localization');
  assert.deepEqual(plugin[1].supportedLocales, { ios: ['en', 'fr', 'ar'], android: ['en', 'fr', 'ar'] });
  for (const file of Object.values(expo.locales)) {
    const locale = require(path.join(__dirname, '..', file));
    assert.ok(locale.ios.NSLocationWhenInUseUsageDescription);
    assert.ok(locale.ios.NSMotionUsageDescription);
    assert.ok(locale.android.app_name);
  }
});

test('the device language is used, falling back to English', () => {
  assert.equal(resolveLanguage('system', ['fr', 'en']), 'fr');
  assert.equal(resolveLanguage('system', ['de', 'ar']), 'ar');
  assert.equal(resolveLanguage('system', ['de', null]), 'en');
  assert.equal(resolveLanguage('system', []), 'en');
});

test('a chosen language overrides the device language', () => {
  assert.equal(resolveLanguage('ar', ['en']), 'ar');
  assert.equal(resolveLanguage('en', ['ar']), 'en');
});

test('only Arabic is right-to-left', () => {
  assert.deepEqual(['en', 'fr', 'ar'].map(isRtl), [false, false, true]);
});

test('numbers follow the language and Arabic keeps Western digits', () => {
  assert.equal(formatNumber('en', 1234.5), '1,234.5');
  assert.equal(formatNumber('fr', 1234.5).replace(/\s/g, ' '), '1 234,5');
  assert.match(formatNumber('ar', 1234), /^1.?234$/);
});

test('dates follow the language', () => {
  const date = Date.UTC(2026, 0, 15, 12);
  const options = { dateStyle: 'long', timeZone: 'UTC' };
  assert.match(formatDateTime('en', date, options), /January 15, 2026/);
  assert.match(formatDateTime('fr', date, options), /15 janvier 2026/);
  assert.match(formatDateTime('ar', date, options), /يناير|جانفي/);
});

test('distances switch from metres to kilometres', () => {
  assert.deepEqual(distanceParts('en', 850.4), { unit: 'distanceMeters', value: '850' });
  assert.deepEqual(distanceParts('fr', 1500), { unit: 'distanceKilometers', value: '1,5' });
});

test('zod reports validation errors in each language', () => {
  const schema = z.string().min(2);
  const message = (locale) => schema.safeParse('a', { error: locale().localeError }).error.issues[0].message;
  const messages = [z.locales.en, z.locales.fr, z.locales.ar].map(message);
  assert.equal(new Set(messages).size, 3);
  assert.match(messages[2], /[؀-ۿ]/);
});

test('Arabic type keeps joined letters and uses the Arabic fonts', () => {
  const arabic = createArabicTypography();
  for (const [name, style] of Object.entries(arabic)) {
    assert.equal(style.letterSpacing, undefined, name);
    assert.ok(Object.values(ArabicFontFamily).includes(style.fontFamily), name);
    assert.ok(style.lineHeight > Typography[name].lineHeight, name);
    assert.equal(style.fontSize, Typography[name].fontSize, name);
  }
});

test('reachable screens have no hard-coded text or physical styles', () => {
  // Tasks and the device playground have no route, so users cannot reach them.
  const skipped = ['features/todos', 'features/device-playground'];
  const files = fs.readdirSync(src, { recursive: true })
    .filter((file) => file.endsWith('.tsx') && !skipped.some((dir) => file.split(path.sep).join('/').startsWith(dir)));
  for (const file of files) {
    const code = fs.readFileSync(path.join(src, file), 'utf8');
    assert.doesNotMatch(code, /\b(?:label|title|description|placeholder|accessibilityLabel)="[^"]*[A-Za-z]/, file);
    assert.doesNotMatch(code, /<(?:ThemedText|Text)\b[^>]*>\s*[A-Za-z][a-z]+ /, file);
    assert.doesNotMatch(code, /\b(?:marginLeft|marginRight|paddingLeft|paddingRight)\b/, file);
  }
});
