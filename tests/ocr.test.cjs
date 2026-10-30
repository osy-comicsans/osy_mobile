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

const { cropImage, resizeBilinear } = require('../src/features/auth/ocr/paddle/image.ts');
const { findTextBoxes, prepareDetection } = require('../src/features/auth/ocr/paddle/detection.ts');
const { ctcDecode, prepareRecognition, toReadingOrder } = require('../src/features/auth/ocr/paddle/recognition.ts');
const { readPage } = require('../src/features/auth/ocr/paddle/pipeline.ts');
const { checkDigit, parseMrz } = require('../src/features/auth/ocr/mrz.ts');
const { parseDocument } = require('../src/features/auth/ocr/documentParser.ts');
const { nameMismatch } = require('../src/features/auth/utils/authForm.ts');

const line = (text, x, y, overrides = {}) => ({
  text, latin: text, arabic: text, confidence: 0.98, x, y, width: 120, height: 20, ...overrides,
});

function solidImage(width, height, value = 200) {
  return { width, height, data: new Uint8Array(width * height * 4).fill(value) };
}

function mrzLines() {
  const number = 'A12345678';
  const birth = '900102';
  const expiry = '300102';
  const line1 = `DLDZA${number}${checkDigit(number)}`.padEnd(30, '<');
  const start = `${birth}${checkDigit(birth)}M${expiry}${checkDigit(expiry)}DZA`.padEnd(29, '<');
  const composite = line1.slice(5, 30) + start.slice(0, 7) + start.slice(8, 15) + start.slice(18, 29);
  return [line1, start + checkDigit(composite), 'BENALI<<AMINA'.padEnd(30, '<')];
}

test('check digits use the 7, 3, 1 weights', () => {
  assert.equal(checkDigit('520727'), 3);
  assert.equal(checkDigit('AB2134<<<'), 5);
});

test('a valid MRZ gives the holder details', () => {
  assert.deepEqual(parseMrz(mrzLines()), {
    documentNumber: 'A12345678', dateOfBirth: '02.01.1990', expiryDate: '300102', sex: 'M',
    lastName: 'BENALI', firstName: 'AMINA', checksPass: true,
  });
});

test('a misread MRZ fails its check digits', () => {
  const lines = mrzLines();
  lines[0] = lines[0].replace('A12345678', 'A12345679');
  assert.equal(parseMrz(lines).checksPass, false);
});

test('text without an MRZ gives nothing', () => {
  assert.equal(parseMrz(['Permis de conduire', 'Algerie']), null);
});

test('detection input is sized in steps of 32, and small photos are enlarged', () => {
  const large = prepareDetection(solidImage(1600, 1000));
  assert.deepEqual(large.dims, [1, 3, 800, 1280]);
  assert.equal(large.tensor.length, 3 * 800 * 1280);
  assert.deepEqual(prepareDetection(solidImage(488, 629)).dims, [1, 3, 1280, 992]);
});

test('joined text pixels become one box, scaled to the image', () => {
  const [width, height] = [100, 40];
  const map = new Float32Array(width * height);
  for (let y = 10; y < 20; y += 1) for (let x = 10; x < 60; x += 1) map[y * width + x] = 0.9;
  const boxes = findTextBoxes(map, width, height, 200, 80);
  assert.equal(boxes.length, 1);
  const [box] = boxes;
  assert.ok(box.x < 20 && box.x + box.width > 120);
  assert.ok(box.y < 20 && box.y + box.height > 40);
});

test('faint specks are not treated as text', () => {
  const [width, height] = [50, 50];
  const map = new Float32Array(width * height);
  for (let y = 5; y < 15; y += 1) for (let x = 5; x < 25; x += 1) map[y * width + x] = 0.4;
  map[40 * width + 40] = 0.9;
  assert.deepEqual(findTextBoxes(map, width, height, 50, 50), []);
});

test('recognition input is 48 high and keeps the shape of the line', () => {
  assert.deepEqual(prepareRecognition(solidImage(200, 24)).dims, [1, 3, 48, 400]);
  assert.deepEqual(prepareRecognition(solidImage(10, 40)).dims, [1, 3, 48, 48]);
});

test('CTC decoding drops blanks and repeats, and keeps a real double letter', () => {
  const dictionary = ['a', 'b'];
  const indexes = [1, 1, 0, 1, 2, 0, 3];
  const classes = 4;
  const scores = new Float32Array(indexes.length * classes);
  indexes.forEach((best, step) => { scores[step * classes + best] = 0.9; });
  const { text, confidence } = ctcDecode(scores, [1, indexes.length, classes], dictionary);
  assert.equal(text, 'aab');
  assert.ok(Math.abs(confidence - 0.9) < 0.001);
});

test('Arabic comes out in reading order, with numbers left as they are', () => {
  assert.equal(toReadingOrder('ﺮﺋاﺰﺠﻟا'), [...'ﺮﺋاﺰﺠﻟا'].reverse().join(''));
  assert.equal(toReadingOrder('2026 ةنس'), 'سنة 2026');
  assert.equal(toReadingOrder('RN 63'), 'RN 63');
});

test('resizing and cropping keep the right pixels', () => {
  const image = solidImage(4, 4, 10);
  image.data[(1 * 4 + 1) * 4] = 250;
  assert.equal(cropImage(image, 1, 1, 2, 2).data[0], 250);
  assert.equal(resizeBilinear(image, 2, 2).data.length, 16);
});

test('the pipeline reads each box with both models and keeps the surer one', async () => {
  const [width, height] = [1280, 640];
  const map = new Float32Array(height * width);
  for (let y = 100; y < 160; y += 1) for (let x = 100; x < 600; x += 1) map[y * width + x] = 0.9;
  const scored = (best, score) => {
    const data = new Float32Array(3);
    data[best] = score;
    return { data, dims: [1, 1, 3] };
  };
  const models = {
    detect: async () => ({ data: map, dims: [1, 1, height, width] }),
    recognize: async (script) => (script === 'latin' ? scored(1, 0.6) : scored(2, 0.95)),
    dictionaries: { latin: ['x', 'y'], arabic: ['ا', 'ب'] },
  };
  const [result] = await readPage(solidImage(width, height), models);
  assert.equal(result.text, 'ب');
  assert.equal(result.latin, 'x');
});

test('a licence is read from the MRZ and its numbered markers', () => {
  const [one, two, three] = mrzLines();
  const front = [
    line('5. B', 10, 10), line('4d 109870123456789012', 10, 40),
    line('3. 02.01.1990', 10, 70), line('الجزائر', 140, 70, { latin: 'x', arabic: 'الجزائر' }),
  ];
  const back = [line(one, 10, 10), line(two, 10, 40), line(three, 10, 70)];
  const { fields, lowConfidence } = parseDocument('driver_license', [front, back]);
  assert.deepEqual(fields, {
    category: 'B', nin: '109870123456789012', licenseNumber: 'A12345678', lastName: 'BENALI',
    firstName: 'AMINA', dateOfBirth: '02.01.1990', placeOfBirth: 'الجزائر',
  });
  assert.deepEqual(lowConfidence, ['placeOfBirth']);
});

test('a failed MRZ check flags its values for review', () => {
  const lines = mrzLines();
  lines[0] = lines[0].replace('A12345678', 'A12345679');
  const { lowConfidence } = parseDocument('driver_license', [lines.map((text, index) => line(text, 10, index * 30))]);
  assert.ok(lowConfidence.includes('licenseNumber') && lowConfidence.includes('lastName'));
});

test('unreadable licence fields stay empty and flagged', () => {
  const { fields, lowConfidence } = parseDocument('driver_license', [[line('31.02.2001', 10, 10)]]);
  assert.equal(fields.dateOfBirth, undefined);
  assert.ok(lowConfidence.includes('dateOfBirth') && lowConfidence.includes('nin'));
});

test('registration values are found beside and below their labels', () => {
  const lines = [
    line('Marque', 10, 10), line('رينو', 140, 10, { arabic: 'رينو', latin: '' }),
    line('Type', 10, 40), line('SYMBOL', 140, 40),
    line('N° dans la série du type', 10, 70), line('vf1 lb000', 140, 70),
    line('N° d\'immatriculation', 10, 100), line('12345-123-16', 10, 122),
    line('Année de première mise en circulation', 10, 160), line('2023', 140, 160),
    line('Places assises: 5', 10, 190),
  ];
  const { fields, lowConfidence } = parseDocument('vehicle_registration', [lines]);
  assert.equal(fields.brand, 'رينو');
  assert.equal(fields.type, 'SYMBOL');
  assert.equal(fields.serialNumber, 'VF1LB000');
  assert.equal(fields.registrationNumber, '12345 123 16');
  assert.equal(fields.firstRegistrationYear, '2023');
  assert.equal(fields.seats, '5');
  assert.ok(lowConfidence.includes('brand'));
  assert.ok(!lowConfidence.includes('type'));
  assert.ok(lowConfidence.includes('energy'));
});

test('a boxed card is read from values printed above their labels', () => {
  const box = (text, x, y, overrides = {}) => line(text, x, y, { width: 60, height: 20, ...overrides });
  const lines = [
    box('XY', 100, 400, { width: 30 }), box('طراز', 150, 400, { latin: '0', text: 'طراز', arabic: 'طراز', width: 40 }),
    box('ABCDEF1234', 300, 390, { width: 120 }), box('R000123', 300, 412, { width: 80 }),
    box('TYPE', 150, 440, { width: 40 }), box('N° DANS LA SERIE DU TYPE', 300, 440, { width: 130 }),
    box('GO', 10, 470), box('008.', 80, 470), box('0051', 150, 470), box('00000', 220, 470), box('00000', 300, 470),
    box('ENEAGIE', 10, 500), box('PUISSANCE', 80, 500), box('PLACES', 150, 500), box('POIDS TOTAL', 220, 500), box('CHARGE', 300, 500),
    box('ASSISES', 150, 520), box('EN CHARGE', 220, 520), box('UTILE', 300, 520),
    box('012345:678.16', 10, 540, { width: 110 }), box('098765.00.48', 150, 540, { width: 110 }),
    box('DATRICITION', 10, 580, { width: 110 }), box('PRECEDENT NUMERO', 150, 580, { width: 110 }),
  ];
  const { fields, lowConfidence } = parseDocument('vehicle_registration', [lines]);
  assert.equal(fields.type, 'XY');
  assert.equal(fields.serialNumber, 'ABCDEF1234R000123');
  assert.equal(fields.energy, 'GO');
  assert.equal(fields.power, '008');
  assert.equal(fields.grossWeight, '00000');
  assert.equal(fields.payload, '00000');
  assert.equal(fields.registrationNumber, '012345 678 16');
  assert.equal(fields.previousNumber, '098765 00 48');
  assert.equal(fields.seats, undefined);
  assert.ok(lowConfidence.includes('seats'));
});

test('weak Arabic-only readings stay empty', () => {
  const lines = [
    line('خط', 10, 10, { arabic: 'خط', latin: '', confidence: 0.6 }),
    line('MARQUE', 10, 40),
  ];
  const { fields, lowConfidence } = parseDocument('vehicle_registration', [lines]);
  assert.equal(fields.brand, undefined);
  assert.ok(lowConfidence.includes('brand'));
});

test('a low-confidence reading is flagged', () => {
  const lines = [line('Type', 10, 10), line('SYMBOL', 140, 10, { confidence: 0.5 })];
  const { fields, lowConfidence } = parseDocument('vehicle_registration', [lines]);
  assert.equal(fields.type, 'SYMBOL');
  assert.ok(lowConfidence.includes('type'));
});

test('names are compared without case or accents', () => {
  const user = { firstName: 'Amina', lastName: 'Benali' };
  assert.equal(nameMismatch({ firstName: 'AMINA', lastName: 'BENÂLI' }, user), false);
  assert.equal(nameMismatch({ firstName: 'SARA', lastName: 'BENALI' }, user), true);
  assert.equal(nameMismatch({}, user), false);
  assert.equal(nameMismatch({ firstName: 'أمينة' }, user), false);
});

test('the runtime is only loaded once its native module exists', () => {
  const engine = fs.readFileSync(path.join(__dirname, '../src/features/auth/ocr/ocrEngine.ts'), 'utf8');
  assert.ok(engine.indexOf('NativeModules.Onnxruntime') < engine.indexOf("require('onnxruntime-react-native')"));
});

test('auth OCR code never logs', () => {
  const directory = path.join(__dirname, '../src/features/auth/ocr');
  for (const file of fs.readdirSync(directory, { recursive: true })) {
    if (!/\.ts$/.test(file)) continue;
    assert.doesNotMatch(fs.readFileSync(path.join(directory, file), 'utf8'), /console\./, file);
  }
});
