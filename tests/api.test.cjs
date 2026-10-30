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

const { ApiError, parseResponse, toApiError } = require('../src/common/lib/api/apiError.ts');
const { installAuthInterceptors } = require('../src/common/lib/api/authInterceptors.ts');
const { authTokensSchema, createAuthSession } = require('../src/common/lib/api/authSession.ts');
const { createAuthApi, createDocumentsApi } = require('../src/features/auth/api/authApi.ts');
const { createSafetyApi } = require('../src/features/safety/api/safetyApi.ts');
const { createProfileApi } = require('../src/features/profile/api/profileApi.ts');

const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const nextTokens = { accessToken: 'access-2', refreshToken: 'refresh-2' };
const user = {
  id: 'user-1', firstName: 'Amina', lastName: 'Test', email: 'amina@example.com',
  mobileNumber: '+213555000000', onboardingStatus: 'documents_required',
};
const registration = {
  firstName: 'Amina', lastName: 'Test', email: ' Amina@Example.com ',
  mobileNumber: '+213555000000', password: 'Secret123',
};

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
}

// Answers requests from a handler, the way a server would.
function clientWith(handler) {
  const requests = [];
  const client = create({
    baseURL: 'https://api.test',
    adapter: async (config) => {
      requests.push(config);
      const { status = 200, data = {} } = await handler(config, requests.length);
      const response = { status, data, statusText: '', headers: {}, config };
      if (status >= 200 && status < 300) return response;
      const { AxiosError } = require('axios');
      throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
    },
  });
  return { client, requests };
}

async function signedInSession() {
  const session = createAuthSession(memoryStorage());
  await session.save(tokens);
  return session;
}

const bearer = (config) => config.headers.get('Authorization');

test('session restores saved tokens and clears them from storage', async () => {
  const storage = memoryStorage({ 'osy.auth.accessToken': 'a', 'osy.auth.refreshToken': 'r' });
  const session = createAuthSession(storage);
  assert.equal(session.status.getState().status, 'unknown');
  await session.restore();
  assert.equal(session.status.getState().status, 'signedIn');
  assert.deepEqual(session.getTokens(), { accessToken: 'a', refreshToken: 'r' });
  await session.clear();
  assert.equal(session.status.getState().status, 'signedOut');
  assert.equal(storage.values.size, 0);
});

test('session treats a partial token pair as signed out', async () => {
  const session = createAuthSession(memoryStorage({ 'osy.auth.accessToken': 'a' }));
  await session.restore();
  assert.equal(session.status.getState().status, 'signedOut');
  assert.equal(session.getTokens(), null);
});

test('session keeps stored tokens when secure storage cannot be read', async () => {
  const storage = memoryStorage({ 'osy.auth.accessToken': 'a', 'osy.auth.refreshToken': 'r' });
  const session = createAuthSession({ ...storage, getItem: async () => { throw new Error('locked'); } });
  await session.restore();
  assert.equal(session.status.getState().status, 'signedOut');
  assert.equal(storage.values.size, 2);
});

test('requests carry the current access token', async () => {
  const session = await signedInSession();
  const { client, requests } = clientWith(() => ({}));
  installAuthInterceptors(client, session, async () => nextTokens);
  await client.get('/me');
  assert.equal(bearer(requests[0]), 'Bearer access-1');
});

test('a 401 refreshes once for concurrent requests and retries them', async () => {
  const session = await signedInSession();
  const { client, requests } = clientWith((config) => (
    bearer(config) === 'Bearer access-1' ? { status: 401 } : { data: { ok: true } }
  ));
  let refreshes = 0;
  installAuthInterceptors(client, session, async (refreshToken) => {
    assert.equal(refreshToken, 'refresh-1');
    refreshes += 1;
    return nextTokens;
  });
  const results = await Promise.all([client.get('/me'), client.get('/incidents/nearby')]);
  assert.equal(refreshes, 1);
  assert.deepEqual(results.map((result) => result.data), [{ ok: true }, { ok: true }]);
  assert.equal(requests.length, 4);
  assert.deepEqual(session.getTokens(), nextTokens);
});

test('a request sent with an old token retries without another refresh', async () => {
  const session = await signedInSession();
  let refreshes = 0;
  const { client } = clientWith(async (config, count) => {
    if (count === 1) {
      await session.save(nextTokens);
      return { status: 401 };
    }
    return { data: { token: bearer(config) } };
  });
  installAuthInterceptors(client, session, async () => { refreshes += 1; return nextTokens; });
  const { data } = await client.get('/me');
  assert.equal(data.token, 'Bearer access-2');
  assert.equal(refreshes, 0);
});

test('a retried request that gets another 401 fails instead of looping', async () => {
  const session = await signedInSession();
  const { client, requests } = clientWith(() => ({ status: 401 }));
  installAuthInterceptors(client, session, async () => nextTokens);
  await assert.rejects(client.get('/me'));
  assert.equal(requests.length, 2);
});

test('a rejected refresh token signs the user out', async () => {
  const session = await signedInSession();
  const { client } = clientWith(() => ({ status: 401 }));
  installAuthInterceptors(client, session, async () => {
    throw new ApiError('unauthorized', 'Rejected', 401);
  });
  await assert.rejects(client.get('/me'));
  assert.equal(session.status.getState().status, 'signedOut');
  assert.equal(session.getTokens(), null);
});

test('a network failure during refresh keeps the user signed in', async () => {
  const session = await signedInSession();
  const { client } = clientWith(() => ({ status: 401 }));
  installAuthInterceptors(client, session, async () => {
    throw new ApiError('network', 'Could not reach the server.');
  });
  await assert.rejects(client.get('/me'));
  assert.equal(session.status.getState().status, 'signedIn');
  assert.deepEqual(session.getTokens(), tokens);
});

test('a refresh that finishes after sign out does not sign the user back in', async () => {
  const session = await signedInSession();
  const { client } = clientWith(() => ({ status: 401 }));
  installAuthInterceptors(client, session, async () => {
    await session.clear();
    return nextTokens;
  });
  await assert.rejects(client.get('/me'));
  assert.equal(session.status.getState().status, 'signedOut');
  assert.equal(session.getTokens(), null);
});

test('errors map to safe kinds without the request body', async () => {
  const body = { error: { code: 'email_taken', message: 'Taken', fields: { email: 'Taken' } } };
  const { client } = clientWith(() => ({ status: 409, data: body }));
  const error = await client.post('/auth/register', { password: 'Secret123' }).catch(toApiError);
  assert.equal(error.kind, 'conflict');
  assert.equal(error.code, 'email_taken');
  assert.deepEqual(error.fields, { email: 'Taken' });
  assert.equal(JSON.stringify(error).includes('Secret123'), false);
  assert.equal(error.config, undefined);

  for (const [status, kind] of [[401, 'unauthorized'], [422, 'validation'], [429, 'rate_limited'], [503, 'server'], [400, 'request']]) {
    const { client: failing } = clientWith(() => ({ status }));
    assert.equal((await failing.get('/').catch(toApiError)).kind, kind);
  }

  const offline = create({ adapter: async (config) => {
    const { AxiosError } = require('axios');
    throw new AxiosError('Network Error', 'ERR_NETWORK', config);
  } });
  assert.equal((await offline.get('/').catch(toApiError)).kind, 'network');
});

test('responses that break the contract are rejected', async () => {
  const { client } = clientWith(() => ({ data: { accessToken: '' } }));
  await assert.rejects(parseResponse(client.get('/'), authTokensSchema), (error) => (
    error instanceof ApiError && error.kind === 'invalid_response'
  ));
});

test('register sends only contract fields and stores the tokens', async () => {
  const session = createAuthSession(memoryStorage());
  const { client, requests } = clientWith(() => ({ status: 201, data: { user, ...tokens } }));
  const authApi = createAuthApi(client, session);
  const result = await authApi.register({ ...registration, confirmPassword: 'Secret123' });
  const sent = JSON.parse(requests[0].data);
  assert.equal(requests[0].url, '/auth/register');
  assert.deepEqual(Object.keys(sent).sort(), ['email', 'firstName', 'lastName', 'mobileNumber', 'password']);
  assert.equal(sent.email, 'amina@example.com');
  assert.deepEqual(result, user);
  assert.deepEqual(session.getTokens(), tokens);
});

test('login stores tokens, and a failed login leaves the user signed out', async () => {
  const session = createAuthSession(memoryStorage());
  let accepted = false;
  const { client } = clientWith(() => (accepted ? { data: { user, ...tokens } } : { status: 401 }));
  const authApi = createAuthApi(client, session);
  await assert.rejects(authApi.login({ email: 'a@example.com', password: 'wrong' }), (error) => error.kind === 'unauthorized');
  assert.equal(session.getTokens(), null);
  accepted = true;
  assert.deepEqual(await authApi.login({ email: 'a@example.com', password: 'right' }), user);
  await authApi.signOut();
  assert.equal(session.getTokens(), null);
});

test('invalid mobile numbers are rejected before any request', async () => {
  const { client, requests } = clientWith(() => ({}));
  const authApi = createAuthApi(client, createAuthSession(memoryStorage()));
  assert.throws(() => authApi.register({ ...registration, mobileNumber: '0555000000' }));
  assert.equal(requests.length, 0);
});

test('document upload sends a multipart form and parses the status', async () => {
  const data = {
    onboardingStatus: 'documents_required',
    documents: [{ type: 'driver_license', status: 'pending', rejectionReason: null, updatedAt: '2026-10-30T10:00:00+01:00' }],
  };
  const { client, requests } = clientWith(() => ({ status: 201, data }));
  const result = await createDocumentsApi(client).upload({
    type: 'driver_license', source: 'scan', uri: 'file:///licence.jpg', fileName: 'licence.jpg',
    mimeType: 'image/jpeg', captureLanguage: 'fr', fields: { nin: '123' },
  });
  assert.equal(requests[0].url, '/me/documents');
  assert.ok(requests[0].data instanceof FormData);
  assert.equal(requests[0].data.get('type'), 'driver_license');
  assert.equal(requests[0].data.get('fields'), '{"nin":"123"}');
  assert.equal(result.documents[0].status, 'pending');
});

test('safety and profile modules follow the contract', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const location = { latitude: 36.75, longitude: 3.05 };
  const incident = {
    id, source: 'user_report', location, occurredAt: '2026-10-30T10:00:00Z',
    type: 'collision', severity: 'serious', injuriesVisible: null, note: null,
  };
  const { note, ...stored } = incident;
  const { client, requests } = clientWith((config) => {
    if (config.url === '/incidents') return { status: 201, data: { ...stored, roadName: null, distanceMeters: null } };
    if (config.url === '/incidents/nearby') return { data: { incidents: [] } };
    if (config.url === '/emergency/escalate') return { status: 201, data: { id, status: 'escalating', liveLocationUrl: null } };
    if (config.url === '/me/emergency-contacts') return { data: { contacts: [] } };
    if (config.url === '/me/push-tokens') return { status: 204 };
    return { data: user };
  });
  const safety = createSafetyApi(client);
  const profile = createProfileApi(client);
  await safety.createIncident(incident);
  await safety.getNearbyIncidents({ ...location, radiusKm: 5 });
  await safety.escalate({
    id, incidentId: id, trigger: 'check_in_timeout', location, speedBeforeImpactKmh: 80,
    roadName: null, roadNumber: null, shareMedicalInfo: false,
  });
  await profile.getProfile();
  await profile.updateProfile({ firstName: 'Amina', lastName: 'Test', mobileNumber: '+213555000000' });
  await profile.replaceEmergencyContacts([]);
  await profile.registerPushToken({ token: 'push', platform: 'android', language: 'fr' });
  assert.deepEqual(
    requests.map((request) => `${request.method} ${request.url}`),
    ['post /incidents', 'get /incidents/nearby', 'post /emergency/escalate', 'get /me', 'put /me',
      'put /me/emergency-contacts', 'post /me/push-tokens'],
  );
  assert.deepEqual(requests[1].params, { ...location, radiusKm: 5 });
  assert.throws(() => profile.registerPushToken({ token: '', platform: 'android', language: 'fr' }));
  assert.throws(() => safety.createIncident({ ...incident, id: 'not-a-uuid' }));
});
