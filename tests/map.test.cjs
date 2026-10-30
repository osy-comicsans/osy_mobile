const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  module._compile(outputText, filename);
};

const { DEFAULT_CENTER, mapStyleUrl } = require('../src/features/map/utils/mapStyle.ts');
const { EMPTY_OVERLAYS, toFeatureCollection } = require('../src/features/map/utils/mapOverlays.ts');

test('the map style follows the colour scheme, without a key', () => {
  assert.match(mapStyleUrl('light'), /liberty$/);
  assert.match(mapStyleUrl('dark'), /dark$/);
  assert.match(mapStyleUrl(null), /liberty$/);
  assert.doesNotMatch(mapStyleUrl('light'), /key=/);
});

test('the fallback centre is longitude first, in Algiers', () => {
  assert.deepEqual(DEFAULT_CENTER, [3.0588, 36.7538]);
});

test('overlays become GeoJSON for the map', () => {
  const collection = toFeatureCollection([
    { id: 'a', geometry: { type: 'Point', coordinates: [3, 36] }, properties: { severity: 'serious' } },
    { id: 'b', geometry: { type: 'LineString', coordinates: [[3, 36], [3.1, 36.1]] } },
  ]);
  assert.equal(collection.type, 'FeatureCollection');
  assert.equal(collection.features[0].id, 'a');
  assert.deepEqual(collection.features[0].properties, { severity: 'serious' });
  assert.deepEqual(collection.features[1].properties, {});
});

test('the risk and incident layers start empty', () => {
  assert.deepEqual(toFeatureCollection(EMPTY_OVERLAYS['risk-roads']).features, []);
  assert.deepEqual(toFeatureCollection(EMPTY_OVERLAYS.incidents).features, []);
});

test('MapLibre is only loaded after the native check', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../src/features/map/screens/MapScreen.tsx'), 'utf8');
  assert.doesNotMatch(screen, /^import \{ MapCanvas/m);
  assert.ok(screen.indexOf('isMapAvailable()') < screen.indexOf("require('../components/MapCanvas')"));
});
