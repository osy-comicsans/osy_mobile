import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// Stands in for the backend until it exists, at the HTTP layer, so the real
// client, interceptors, and schemas all run. It follows API_CONTRACT.md.
//
// demo@osy.test     finished onboarding, any password
// taken@osy.test    needs documents, also shows the "already registered" error
// offline@osy.test  fails like a lost connection
// Password `Wrong123`, or any document field containing REJECT, shows that failure.

const STORAGE_KEY = 'osy.mock.backend';
const LATENCY_MS = 400;

type DocumentType = 'driver_license' | 'vehicle_registration';

interface MockDocument {
  type: DocumentType;
  status: 'missing' | 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  updatedAt: string | null;
}

// Passwords and document data are never kept, even in the mock.
interface MockUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  documents: Record<DocumentType, MockDocument>;
  contacts?: unknown[];
  photoUrl?: string | null;
  vehicle?: string | null;
  medical?: { bloodType: string; allergies: string; conditions: string };
  preferences?: unknown;
  reports?: { id: string; occurredAt: string; type: string; severity: string; status: string }[];
}

interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface MockReply {
  status: number;
  data?: unknown;
}

function emptyDocuments(status: MockDocument['status'] = 'missing') {
  const document = (type: DocumentType): MockDocument => ({
    type, status, rejectionReason: null, updatedAt: null,
  });
  return { driver_license: document('driver_license'), vehicle_registration: document('vehicle_registration') };
}

const seedUsers: MockUser[] = [
  {
    id: 'mock-demo', firstName: 'Demo', lastName: 'Driver', email: 'demo@osy.test',
    mobileNumber: '+213555000001', documents: emptyDocuments('verified'),
  },
  {
    id: 'mock-taken', firstName: 'Taken', lastName: 'Driver', email: 'taken@osy.test',
    mobileNumber: '+213555000000', documents: emptyDocuments(),
  },
];

function fail(status: number, code: string, message: string, fields?: Record<string, string>): MockReply {
  return { status, data: { error: { code, message, ...(fields ? { fields } : {}) } } };
}

// Reads a text field from web FormData or React Native's FormData.
function formField(form: unknown, name: string): string {
  const { get, getParts } = form as {
    get?: (key: string) => unknown;
    getParts?: () => { fieldName: string; string?: string }[];
  };
  const value = get?.call(form, name) ?? getParts?.call(form).find((part) => part.fieldName === name)?.string;
  return typeof value === 'string' ? value : '';
}

export function createMockBackend(storage: MockStorage, latency = LATENCY_MS, options = { persistSensitive: true }): AxiosAdapter {
  let ephemeral: MockUser[] | undefined;
  const load = (): MockUser[] => {
    if (!options.persistSensitive && ephemeral) return ephemeral;
    const saved = storage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as MockUser[]) : JSON.parse(JSON.stringify(seedUsers)) as MockUser[];
  };
  const save = (users: MockUser[]) => {
    if (options.persistSensitive) storage.setItem(STORAGE_KEY, JSON.stringify(users));
    else {
      ephemeral = users;
      const nonSensitive = users.map(({ medical: _medical, contacts: _contacts, reports: _reports, photoUrl: _photo, ...user }) => user);
      storage.setItem(STORAGE_KEY, JSON.stringify(nonSensitive));
    }
  };

  const profile = ({ documents, contacts: _contacts, reports: _reports, preferences: _preferences, ...user }: MockUser) => ({ ...user, onboardingStatus: onboardingStatus(documents) });

  function onboardingStatus(documents: MockUser['documents']) {
    return Object.values(documents).every(({ status }) => status === 'pending' || status === 'verified')
      ? 'complete'
      : 'documents_required';
  }

  const documentsResponse = ({ documents }: MockUser) => ({
    documents: Object.values(documents),
    onboardingStatus: onboardingStatus(documents),
  });

  const authResponse = (user: MockUser) => ({
    user: profile(user),
    accessToken: `mock-access.${user.id}`,
    refreshToken: `mock-refresh.${user.id}`,
  });

  const signedInUser = (users: MockUser[], request: InternalAxiosRequestConfig) => {
    const token = String(request.headers.get('Authorization') ?? '');
    return users.find((user) => token === `Bearer mock-access.${user.id}`);
  };

  function route(request: InternalAxiosRequestConfig): MockReply {
    const key = `${request.method?.toUpperCase()} ${request.url}`;
    const body = typeof request.data === 'string' ? JSON.parse(request.data) : request.data;
    const users = load();

    if (key === 'POST /auth/register') {
      const fields: Record<string, string> = {};
      if (users.some((user) => user.email === body.email)) fields.email = 'This email is already registered.';
      if (users.some((user) => user.mobileNumber === body.mobileNumber)) {
        fields.mobileNumber = 'This mobile number is already registered.';
      }
      if (Object.keys(fields).length > 0) return fail(409, 'already_registered', 'Already registered.', fields);

      const { firstName, lastName, email, mobileNumber } = body;
      const user: MockUser = {
        id: `mock-${users.length}-${email}`, firstName, lastName, email, mobileNumber, documents: emptyDocuments(),
      };
      save([...users, user]);
      return { status: 201, data: authResponse(user) };
    }

    if (key === 'POST /auth/login') {
      const user = users.find((candidate) => candidate.email === body.email);
      if (!user || body.password === 'Wrong123') return fail(401, 'invalid_credentials', 'Wrong email or password.');
      return { status: 200, data: authResponse(user) };
    }

    if (key === 'POST /auth/refresh') {
      const user = users.find(({ id }) => body.refreshToken === `mock-refresh.${id}`);
      if (!user) return fail(401, 'invalid_token', 'Sign in again.');
      const { accessToken, refreshToken } = authResponse(user);
      return { status: 200, data: { accessToken, refreshToken } };
    }

    const user = signedInUser(users, request);
    if (!user) return fail(401, 'unauthorized', 'Sign in again.');
    const expectedOwner = request.headers.get('X-OSY-Owner');
    if (expectedOwner && expectedOwner !== user.id) return fail(403, 'account_changed', 'Account changed.');

    if (key === 'GET /me') return { status: 200, data: profile(user) };
    if (key === 'PUT /me') {
      const { firstName, lastName, mobileNumber, vehicle, medical } = body;
      Object.assign(user, { firstName, lastName, mobileNumber, vehicle, medical }); save(users);
      return { status: 200, data: profile(user) };
    }
    if (key === 'PUT /me/photo') {
      const parts = (body as { getParts?: () => { fieldName: string; uri?: string }[] }).getParts?.();
      const uri = parts?.find((part) => part.fieldName === 'photo')?.uri;
      if (!uri) return fail(422, 'invalid_photo', 'Choose a photo on a device.');
      user.photoUrl = uri; save(users); return { status: 200, data: { photoUrl: uri } };
    }
    if (key === 'GET /me/driving-stats') return { status: 200, data: { trips: 0, distanceMeters: 0, warnings: 0 } };
    if (key === 'GET /me/reports') return { status: 200, data: { reports: user.reports ?? [] } };
    if (key === 'PUT /me/preferences') { user.preferences = body; save(users); return { status: 204 }; }
    if (key === 'DELETE /me/data') {
      user.contacts = []; user.medical = { bloodType: '', allergies: '', conditions: '' }; user.reports = [];
      user.photoUrl = null; user.vehicle = null; user.preferences = undefined;
      save(users); return { status: 204 };
    }
    if (key === 'DELETE /me') { save(users.filter(({ id }) => id !== user.id)); return { status: 204 }; }
    if (key === 'GET /me/documents') return { status: 200, data: documentsResponse(user) };
    if (key === 'POST /me/push-tokens') return { status: 204 };

    if (key === 'GET /me/emergency-contacts') return { status: 200, data: { contacts: user.contacts ?? [] } };
    if (key === 'PUT /me/emergency-contacts') {
      user.contacts = body.contacts;
      save(users);
      return { status: 200, data: { contacts: body.contacts } };
    }

    // Nothing is sent to anyone. The real backend notifies contacts by SMS or push.
    if (key === 'POST /incidents') {
      const { note: _note, ...incident } = body;
      if (body.source === 'user_report') {
        user.reports = [{ id: body.id, occurredAt: body.occurredAt, type: body.type, severity: body.severity, status: 'received' },
          ...(user.reports ?? []).filter(({ id }) => id !== body.id)].slice(0, 100);
        save(users);
      }
      return { status: 201, data: { ...incident, roadName: null, distanceMeters: null } };
    }
    if (request.method?.toUpperCase() === 'POST' && /^\/incidents\/[^/]+\/photo$/.test(request.url ?? '')) {
      return { status: 204 };
    }
    if (key === 'POST /emergency/escalate') {
      return { status: 201, data: { id: body.id, status: 'escalating', liveLocationUrl: null } };
    }
    const escalation = request.url?.match(/^\/emergency\/escalate\/([^/]+)\/(location|cancel)$/);
    if (request.method?.toUpperCase() === 'POST' && escalation) {
      if (escalation[2] === 'location') return { status: 204 };
      return { status: 200, data: { id: escalation[1], status: 'canceled', liveLocationUrl: null } };
    }

    if (key === 'POST /me/documents') {
      const type = formField(body, 'type') as DocumentType;
      const rejected = formField(body, 'fields').includes('REJECT');
      user.documents[type] = {
        type,
        status: rejected ? 'rejected' : 'pending',
        rejectionReason: rejected ? 'The document could not be read. Try again in better light.' : null,
        updatedAt: new Date().toISOString(),
      };
      save(users);
      return { status: 201, data: documentsResponse(user) };
    }

    return fail(404, 'not_mocked', `No mock for ${key}.`);
  }

  return async (request) => {
    await new Promise((resolve) => { setTimeout(resolve, latency); });

    const body = typeof request.data === 'string' ? request.data : '';
    if (body.includes('offline@osy.test')) {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, request);
    }

    const { status, data } = route(request);
    const response: AxiosResponse = { status, data, statusText: '', headers: {}, config: request };
    if (status < 400) return response;
    throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, request, null, response);
  };
}
