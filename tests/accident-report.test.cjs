const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const Module = require('node:module');
const { create } = require('axios');
const { SQLiteConnection } = require('./support/sqlite.cjs');

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(__dirname, '../src', request.slice(2)) : request;
  return resolveFilename.call(this, mapped, ...rest);
};

const { ApiError } = require('../src/common/lib/api/apiError.ts');
const { createMockBackend } = require('../src/common/lib/api/mock/mockBackend.ts');
const { LocalDatabase } = require('../src/common/lib/database/localDatabase.ts');
const { migrateDatabase } = require('../src/common/lib/database/migrations/index.ts');
const {
  AccidentReportRepository, ACCIDENT_REPORT_ENTITY,
} = require('../src/common/lib/database/repositories/accidentReportRepository.ts');
const { createAccidentReportSyncAdapter } = require('../src/common/lib/database/sync/createAccidentReportSyncAdapter.ts');
const { SyncManager } = require('../src/common/lib/database/sync/syncManager.ts');
const { SyncQueue } = require('../src/common/lib/database/sync/syncQueue.ts');
const { createSafetyApi } = require('../src/features/safety/api/safetyApi.ts');
const { incidentRequestSchema } = require('../src/features/safety/types/safety.schemas.ts');
const {
  canSubmitReport, isFreshFix, reportPhotoName, toIncidentRequest,
} = require('../src/features/safety/utils/accidentReport.ts');

const NOW = Date.parse('2026-10-31T10:00:00Z');
const complete = {
  location: { latitude: 36.75, longitude: 3.05 }, type: 'collision', severity: 'serious', injuries: null, note: '',
};
const report = () => toIncidentRequest(complete, randomUUID(), NOW);

async function fixture(t, transport, files = new Map()) {
  const connection = new SQLiteConnection();
  t.after(() => connection.close());
  await migrateDatabase(connection);
  const database = new LocalDatabase(async () => connection);
  const queue = new SyncQueue(database);
  const reports = new AccidentReportRepository(database, randomUUID, () => NOW);
  const state = { online: false, time: NOW, errors: [] };
  const sync = new SyncManager(queue, {
    canSync: () => state.online, onChange: async () => {}, onRunning: () => {},
    onError: (message) => state.errors.push(message), onSuccess: () => {},
    now: () => state.time, random: () => 0.5,
  });
  const photos = {
    uriOf: (name) => (files.has(name) ? `file:///${name}` : null),
    remove: (name) => files.delete(name),
  };
  sync.register(ACCIDENT_REPORT_ENTITY, createAccidentReportSyncAdapter(transport, photos));
  return { connection, queue, reports, state, sync, files };
}

function recordingTransport(overrides = {}) {
  const sent = { reports: [], photos: [] };
  return {
    sent,
    createIncident: async (value) => { sent.reports.push(value); },
    uploadIncidentPhoto: async (id, photo) => { sent.photos.push({ id, ...photo }); },
    ...overrides,
  };
}

test('a report needs a location, a type, and a severity', () => {
  assert.equal(canSubmitReport(complete), true);
  for (const field of ['location', 'type', 'severity']) {
    assert.equal(canSubmitReport({ ...complete, [field]: null }), false);
  }
  assert.throws(() => toIncidentRequest({ ...complete, type: null }, randomUUID(), NOW));
});

test('the form becomes a valid incident', () => {
  const answers = { yes: true, no: false, unsure: null };
  for (const [injuries, expected] of Object.entries(answers)) {
    const request = toIncidentRequest({ ...complete, injuries, note: '  two cars  ' }, randomUUID(), NOW);
    assert.equal(incidentRequestSchema.safeParse(request).success, true);
    assert.equal(request.injuriesVisible, expected);
    assert.equal(request.note, 'two cars');
    assert.equal(request.source, 'user_report');
  }
  assert.equal(report().note, null);
});

test('a report carries coordinates only, not the rest of the location fix', () => {
  const location = { ...complete.location, speedKmh: 90, timestamp: NOW };
  assert.deepEqual(toIncidentRequest({ ...complete, location }, randomUUID(), NOW).location, complete.location);
});

test('an old fix is not used as the accident location', () => {
  assert.equal(isFreshFix({ timestamp: NOW - 60_000 }, NOW), true);
  assert.equal(isFreshFix({ timestamp: NOW - 6 * 60_000 }, NOW), false);
  assert.equal(isFreshFix(null, NOW), false);
});

test('photo names follow the file type', () => {
  assert.equal(reportPhotoName('a', 'image/png'), 'a.png');
  assert.equal(reportPhotoName('a', 'image/jpeg'), 'a.jpg');
});

test('a report made offline is delivered when the connection returns', async (t) => {
  const transport = recordingTransport();
  const f = await fixture(t, transport);
  const value = report();
  await f.reports.save(value, null);

  await f.sync.requestSync();
  assert.deepEqual(transport.sent.reports, []);
  assert.equal((await f.queue.summary()).pending, 1);

  f.state.online = true;
  await f.sync.requestSync();
  assert.deepEqual(transport.sent.reports, [value]);
  assert.equal((await f.queue.summary()).pending, 0);

  await f.sync.requestSync();
  assert.equal(transport.sent.reports.length, 1);
});

test('a report survives a failed delivery and keeps its id', async (t) => {
  let attempts = 0;
  const ids = [];
  const f = await fixture(t, recordingTransport({
    createIncident: async ({ id }) => {
      ids.push(id);
      attempts += 1;
      if (attempts === 1) throw new ApiError('network', 'Could not reach the server.');
    },
  }));
  await f.reports.save(report(), null);
  f.state.online = true;
  await f.sync.requestSync();
  assert.equal((await f.queue.summary()).failed, 1);

  f.state.time += 60_000;
  await f.sync.requestSync();
  assert.equal(attempts, 2);
  assert.equal(ids[0], ids[1]);
  assert.deepEqual(await f.queue.summary(), { pending: 0, failed: 0, conflicts: 0 });
});

test('the photo follows the report, then leaves the phone', async (t) => {
  const order = [];
  const transport = recordingTransport({
    createIncident: async () => { order.push('report'); },
    uploadIncidentPhoto: async (id, photo) => { order.push(`photo ${photo.uri} ${photo.mimeType}`); },
  });
  const f = await fixture(t, transport, new Map([['p.jpg', true]]));
  await f.reports.save(report(), { photoName: 'p.jpg', mimeType: 'image/jpeg' });
  f.state.online = true;
  await f.sync.requestSync();
  assert.deepEqual(order, ['report', 'photo file:///p.jpg image/jpeg']);
  assert.equal(f.files.size, 0);
});

test('a failed photo upload does not send the report again', async (t) => {
  let uploads = 0;
  const transport = recordingTransport({
    uploadIncidentPhoto: async () => {
      uploads += 1;
      if (uploads === 1) throw new ApiError('network', 'Could not reach the server.');
    },
  });
  const f = await fixture(t, transport, new Map([['p.jpg', true]]));
  await f.reports.save(report(), { photoName: 'p.jpg', mimeType: 'image/jpeg' });
  f.state.online = true;
  await f.sync.requestSync();
  assert.equal(f.files.size, 1);

  f.state.time += 60_000;
  await f.sync.requestSync();
  assert.equal(uploads, 2);
  assert.equal(transport.sent.reports.length, 1);
  assert.equal(f.files.size, 0);
});

test('a photo refused by the server is dropped, and a missing one is skipped', async (t) => {
  const refused = await fixture(t, recordingTransport({
    uploadIncidentPhoto: async () => { throw new ApiError('request', 'Too large.', 413); },
  }), new Map([['p.jpg', true]]));
  await refused.reports.save(report(), { photoName: 'p.jpg', mimeType: 'image/jpeg' });
  refused.state.online = true;
  await refused.sync.requestSync();
  assert.equal(refused.files.size, 0);
  assert.equal((await refused.queue.summary()).pending, 0);

  const transport = recordingTransport();
  const missing = await fixture(t, transport);
  await missing.reports.save(report(), { photoName: 'gone.jpg', mimeType: 'image/jpeg' });
  missing.state.online = true;
  await missing.sync.requestSync();
  assert.deepEqual(transport.sent.photos, []);
  assert.equal((await missing.queue.summary()).pending, 0);
});

test('a refused report stops retrying, and rate limiting keeps it queued', async (t) => {
  const refused = await fixture(t, recordingTransport({
    createIncident: async () => { throw new ApiError('validation', 'Bad report.', 422); },
  }));
  await refused.reports.save(report(), null);
  refused.state.online = true;
  await refused.sync.requestSync();
  assert.equal((await refused.queue.summary()).conflicts, 1);

  const limited = await fixture(t, recordingTransport({
    createIncident: async () => { throw new ApiError('rate_limited', 'Slow down.', 429); },
  }));
  await limited.reports.save(report(), null);
  limited.state.online = true;
  await limited.sync.requestSync();
  assert.equal((await limited.queue.summary()).failed, 1);
});

test('delivered reports are removed from the phone, and waiting ones stay', async (t) => {
  const f = await fixture(t, recordingTransport());
  await f.reports.save(report(), null);
  f.state.online = true;
  await f.sync.requestSync();
  f.state.online = false;
  await f.reports.save(report(), null);

  await f.reports.clearDelivered();
  const rows = await f.connection.getAllAsync('SELECT status FROM sync_queue');
  assert.deepEqual(rows.map(({ status }) => status), ['pending']);
});

test('the profile lists reports still waiting to send, newest first, but not refused or delivered ones', async (t) => {
  let refuse = false;
  const f = await fixture(t, recordingTransport({
    createIncident: async () => { if (refuse) throw new ApiError('validation', 'Bad report.', 422); },
  }));
  await f.reports.save(report(), null);
  f.state.online = true;
  await f.sync.requestSync();
  refuse = true;
  await f.reports.save(report(), null);
  await f.sync.requestSync();
  f.state.online = false;
  const older = report(); const newer = report();
  await f.reports.save(older, { photoName: 'p.jpg', mimeType: 'image/jpeg' });
  await f.reports.save(newer, null);

  assert.deepEqual((await f.reports.waiting()).map(({ id }) => id), [newer.id, older.id]);
});

test('the mock backend accepts a report and its photo', async () => {
  const storage = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  const client = create({ adapter: createMockBackend(storage, 0), headers: { Authorization: 'Bearer mock-access.mock-demo' } });
  const safety = createSafetyApi(client);
  const value = report();
  const saved = await safety.createIncident(value);
  assert.equal(saved.id, value.id);
  await assert.doesNotReject(safety.uploadIncidentPhoto(value.id, { uri: 'file:///p.jpg', mimeType: 'image/jpeg' }));
});
