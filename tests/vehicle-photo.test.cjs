const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pickVehiclePhoto, vehiclePhotoSearches } = require('../src/features/profile/utils/vehiclePhoto.ts');

const page = (title, index, source = `https://upload.wikimedia.org/${index}.jpg`) => ({ title, index, thumbnail: { source } });

test('the first result naming the make and model wins', () => {
  const response = { query: { pages: [page('Dacia Logan', 2), page('Renault Symbol', 1)] } };
  assert.equal(pickVehiclePhoto(response, 'RENAULT SYMBOL 1.6'), 'https://upload.wikimedia.org/1.jpg');
});

test('photos on the thumbnail host are accepted', () => {
  const source = 'https://thumb.wikimedia.org/Renault_Symbol.jpg';
  assert.equal(pickVehiclePhoto({ query: { pages: [page('Renault Symbol', 1, source)] } }, 'Renault Symbol'), source);
});

test('another car, or an image from elsewhere, gives no photo', () => {
  assert.equal(pickVehiclePhoto({ query: { pages: [page('Dacia Logan', 1)] } }, 'Renault Symbol'), null);
  assert.equal(pickVehiclePhoto({ query: { pages: [page('Renault Symbol', 1, 'https://evil.test/a.jpg')] } }, 'Renault Symbol'), null);
  assert.equal(pickVehiclePhoto({ query: { pages: [page('Chery QQ', 1, 'https://thumb.wikimedia.org/QQ_logo.png')] } }, 'Chery QQ'), null);
  assert.equal(pickVehiclePhoto({}, 'Renault Symbol'), null);
  assert.equal(pickVehiclePhoto({ query: { pages: [page('Renault', 1)] } }, 'Renault'), null);
});

test('a long registration type also searches for just the make and first word', () => {
  assert.deepEqual(vehiclePhotoSearches('RENAULT CLIO 4 1.5 DCI'), ['renault clio 4 1.5 dci', 'renault clio']);
  assert.deepEqual(vehiclePhotoSearches('Peugeot 208'), ['peugeot 208']);
});
