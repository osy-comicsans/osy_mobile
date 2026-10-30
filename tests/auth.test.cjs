const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { create } = require('axios');

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

const { ApiError, toApiError } = require('../src/common/lib/api/apiError.ts');
const { createAuthSession } = require('../src/common/lib/api/authSession.ts');
const { createMockBackend } = require('../src/common/lib/api/mock/mockBackend.ts');
const { createAuthApi, createDocumentsApi } = require('../src/features/auth/api/authApi.ts');
const {
  DOCUMENT_FIELDS, documentFileSchema, loginFormSchema, registerFormSchema,
} = require('../src/features/auth/types/auth.schemas.ts');
const { createAccountService } = require('../src/features/auth/utils/accountService.ts');
const {
  fieldErrors, formErrorKey, loginErrorKey, mapRegisterError, missingFields, nextDocument,
} = require('../src/features/auth/utils/authForm.ts');
const en = require('../src/common/lib/i18n/locales/en.json');

const valid = {
  firstName: 'Amina', lastName: 'Test', email: ' Amina@Example.com ', mobileNumber: '+213555123456',
  password: 'Secret123', confirmPassword: 'Secret123',
};

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

const asyncMemory = (store) => ({
  getItem: async (key) => store.getItem(key),
  setItem: async (key, value) => store.setItem(key, value),
  removeItem: async (key) => store.removeItem(key),
});

function backend(store = memory()) {
  const adapter = createMockBackend(store, 0);
  const session = createAuthSession(asyncMemory(memory()));
  const client = create({ baseURL: 'https://mock.test', adapter });
  client.interceptors.request.use((request) => {
    const token = session.getTokens()?.accessToken;
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  });
  const auth = createAuthApi(client, session);
  const documents = createDocumentsApi(client);
  return { store, session, auth, documents };
}

const page = (side) => ({ side, uri: `file:///${side}.jpg`, fileName: `${side}.jpg`, mimeType: 'image/jpeg' });
const upload = (type, fields = { nin: '1' }) => ({
  type, source: 'upload', pages: [page('front'), page('back')], captureLanguage: 'fr', fields,
  consentVersion: 'v1', consentedAt: '2026-10-30T10:00:00+01:00',
});

test('a valid form has no errors', () => {
  assert.deepEqual(fieldErrors(registerFormSchema, valid), {});
});

test('each invalid field shows its own message', () => {
  const errors = fieldErrors(registerFormSchema, {
    firstName: 'A', lastName: 'x'.repeat(51), email: 'nope', mobileNumber: '0555123456',
    password: 'short', confirmPassword: 'short',
  });
  assert.equal(errors.firstName, 'auth.errors.nameShort');
  assert.equal(errors.lastName, 'auth.errors.nameLong');
  assert.equal(errors.email, 'auth.errors.emailInvalid');
  assert.equal(errors.mobileNumber, 'auth.errors.mobileInvalid');
  assert.equal(errors.password, 'auth.errors.passwordShort');
});

test('password rules each have a message', () => {
  const error = (password) => fieldErrors(registerFormSchema, { ...valid, password, confirmPassword: password }).password;
  assert.equal(error('SECRET123'), 'auth.errors.passwordLowercase');
  assert.equal(error('secret123'), 'auth.errors.passwordUppercase');
  assert.equal(error('SecretWord'), 'auth.errors.passwordNumber');
  assert.equal(error(`Aa1${'x'.repeat(70)}`), 'auth.errors.passwordLong');
});

test('mismatched passwords block the form', () => {
  const errors = fieldErrors(registerFormSchema, { ...valid, confirmPassword: 'Different1' });
  assert.deepEqual(errors, { confirmPassword: 'auth.errors.passwordMismatch' });
});

test('the email is trimmed and lowercased, and confirmPassword stays out of the request', async () => {
  const { auth, store } = backend();
  const { confirmPassword, ...request } = registerFormSchema.parse(valid);
  assert.equal(request.email, 'amina@example.com');
  await auth.register({ ...request, confirmPassword });
  assert.doesNotMatch(store.getItem('osy.mock.backend'), /Secret123/);
});

test('login needs an email and a password', () => {
  assert.deepEqual(fieldErrors(loginFormSchema, { email: '', password: '' }), {
    email: 'auth.errors.emailInvalid', password: 'auth.errors.passwordRequired',
  });
});

test('document files are limited by type and size', () => {
  assert.deepEqual(fieldErrors(documentFileSchema, { mimeType: 'application/pdf', sizeBytes: 1000 }), {});
  assert.equal(fieldErrors(documentFileSchema, { mimeType: 'image/gif', sizeBytes: 1 }).mimeType, 'documents.errors.fileType');
  assert.equal(fieldErrors(documentFileSchema, { mimeType: 'image/png', sizeBytes: 11 * 1024 * 1024 }).sizeBytes, 'documents.errors.fileSize');
});

test('a taken email or mobile number maps to its field', () => {
  const mapped = mapRegisterError(new ApiError('conflict', 'Taken', 409, 'taken', { email: 'x', mobileNumber: 'y' }));
  assert.deepEqual(mapped.fieldKeys, { email: 'auth.errors.emailTaken', mobileNumber: 'auth.errors.mobileTaken' });
  assert.equal(mapped.formKey, null);
});

test('422 errors map to the matching fields', () => {
  const mapped = mapRegisterError(new ApiError('validation', 'Bad', 422, 'bad', { firstName: 'Too odd.' }));
  assert.deepEqual(mapped.fieldText, { firstName: 'Too odd.' });
});

test('other errors become a form message', () => {
  assert.equal(mapRegisterError(new ApiError('server', 'Down', 500)).formKey, 'errors.api.server');
  assert.equal(mapRegisterError(new Error('odd')).formKey, 'errors.api.request');
  assert.equal(formErrorKey(new ApiError('network', 'Down')), 'errors.api.network');
});

test('a wrong login gives one generic message', () => {
  assert.equal(loginErrorKey(new ApiError('unauthorized', 'No', 401)), 'auth.errors.invalidCredentials');
  assert.equal(loginErrorKey(new ApiError('network', 'Down')), 'errors.api.network');
});

test('the next document is the first one still needed', () => {
  const docs = (first, second) => [
    { type: 'driver_license', status: first }, { type: 'vehicle_registration', status: second },
  ];
  assert.equal(nextDocument([]), 'driver_license');
  assert.equal(nextDocument(docs('pending', 'missing')), 'vehicle_registration');
  assert.equal(nextDocument(docs('rejected', 'verified')), 'driver_license');
  assert.equal(nextDocument(docs('pending', 'verified')), null);
});

test('all document fields are required except the previous number', () => {
  const full = Object.fromEntries(DOCUMENT_FIELDS.vehicle_registration.map((field) => [field, '1']));
  delete full.previousNumber;
  assert.deepEqual(missingFields('vehicle_registration', full), []);
  assert.deepEqual(missingFields('vehicle_registration', { ...full, brand: '  ' }), ['brand']);
});

test('every form message and field has a label', () => {
  for (const key of ['nameShort', 'mobileInvalid', 'passwordMismatch', 'invalidCredentials']) assert.ok(en.auth.errors[key]);
  for (const field of Object.values(DOCUMENT_FIELDS).flat()) assert.ok(en.documents.fields[field], field);
});

test('the mock registers a user and signs them in again', async () => {
  const { auth } = backend();
  const { confirmPassword: _c, ...request } = registerFormSchema.parse(valid);
  const user = await auth.register(request);
  assert.equal(user.onboardingStatus, 'documents_required');
  assert.equal((await auth.login({ email: request.email, password: 'Secret123' })).id, user.id);
});

test('the mock rejects a taken email and mobile number', async () => {
  const { auth } = backend();
  const { confirmPassword: _c, ...request } = registerFormSchema.parse(valid);
  const error = await auth.register({ ...request, email: 'taken@osy.test', mobileNumber: '+213555000000' }).catch(toApiError);
  assert.equal(error.kind, 'conflict');
  assert.deepEqual(Object.keys(error.fields).sort(), ['email', 'mobileNumber']);
});

test('the mock simulates a wrong password and a lost connection', async () => {
  const { auth } = backend();
  const wrong = await auth.login({ email: 'demo@osy.test', password: 'Wrong123' }).catch((error) => error);
  assert.equal(wrong.kind, 'unauthorized');
  const lost = await auth.login({ email: 'offline@osy.test', password: 'x' }).catch((error) => error);
  assert.equal(lost.kind, 'network');
});

test('both documents complete onboarding, and a rejected one does not', async () => {
  const { auth, documents } = backend();
  await auth.login({ email: 'taken@osy.test', password: 'x' });
  assert.equal((await documents.list()).onboardingStatus, 'documents_required');
  const rejected = await documents.upload(upload('driver_license', { nin: 'REJECT' }));
  assert.equal(rejected.documents[0].status, 'rejected');
  assert.ok(rejected.documents[0].rejectionReason);
  await documents.upload(upload('driver_license'));
  const done = await documents.upload(upload('vehicle_registration'));
  assert.equal(done.onboardingStatus, 'complete');
});

test('mock state survives a relaunch', async () => {
  const store = memory();
  const first = backend(store);
  await first.auth.login({ email: 'taken@osy.test', password: 'x' });
  await first.documents.upload(upload('driver_license'));
  const second = backend(store);
  await second.auth.login({ email: 'taken@osy.test', password: 'x' });
  assert.equal(nextDocument((await second.documents.list()).documents), 'vehicle_registration');
});

function account({ tokens = {}, listDocuments, storage = memory() }) {
  const session = createAuthSession(asyncMemory(memory(tokens)));
  const service = createAccountService({ session, listDocuments, storage });
  service.start();
  return { service, session, storage, phase: () => service.store.getState().phase };
}

const settle = () => new Promise(setImmediate);
const signedIn = { 'osy.auth.accessToken': 'a', 'osy.auth.refreshToken': 'r' };
const incomplete = { documents: [], onboardingStatus: 'documents_required' };
const complete = { documents: [], onboardingStatus: 'complete' };

test('a signed-out user lands on the signed-out phase', async () => {
  const f = account({ listDocuments: async () => complete });
  assert.equal(f.phase(), 'loading');
  await settle();
  assert.equal(f.phase(), 'signedOut');
});

test('a user who quit mid-onboarding returns to onboarding', async () => {
  const f = account({ tokens: signedIn, listDocuments: async () => incomplete });
  await settle();
  assert.equal(f.phase(), 'onboarding');
});

test('only a complete account reaches the app', async () => {
  const f = account({ tokens: signedIn, listDocuments: async () => complete });
  await settle();
  assert.equal(f.phase(), 'ready');
});

test('signing in loads the account, and signing out ends it', async () => {
  const f = account({ listDocuments: async () => incomplete });
  await settle();
  await f.session.save({ accessToken: 'a', refreshToken: 'r' });
  await settle();
  assert.equal(f.phase(), 'onboarding');
  await f.session.clear();
  assert.equal(f.phase(), 'signedOut');
});

test('offline, a finished user still gets into the app', async () => {
  const storage = memory({ 'osy.auth.onboardingComplete': '1' });
  const f = account({ tokens: signedIn, storage, listDocuments: async () => { throw new ApiError('network', 'Down'); } });
  await settle();
  assert.equal(f.phase(), 'ready');
});

test('offline, an unfinished user stays in onboarding with a retry', async () => {
  const f = account({ tokens: signedIn, listDocuments: async () => { throw new ApiError('network', 'Down'); } });
  await settle();
  assert.equal(f.phase(), 'onboarding');
  assert.equal(f.service.store.getState().loadFailed, true);
});

test('signing out forgets the finished state', async () => {
  const storage = memory();
  const f = account({ tokens: signedIn, storage, listDocuments: async () => complete });
  await settle();
  assert.equal(storage.getItem('osy.auth.onboardingComplete'), '1');
  await f.session.clear();
  assert.equal(storage.getItem('osy.auth.onboardingComplete'), null);
});

test('auth code never logs', () => {
  const directories = ['features/auth', 'common/lib/api'];
  for (const directory of directories) {
    for (const file of fs.readdirSync(path.join(__dirname, '../src', directory), { recursive: true })) {
      if (!/\.tsx?$/.test(file)) continue;
      assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../src', directory, file), 'utf8'), /console\./, file);
    }
  }
});
