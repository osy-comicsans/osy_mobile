const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { QueryClient, onlineManager } = require('@tanstack/react-query');
const { SQLiteConnection } = require('./support/sqlite.cjs');
const { LocalDatabase } = require('../src/common/lib/database/localDatabase.ts');
const { migrateDatabase } = require('../src/common/lib/database/migrations/index.ts');
const { TodoRepository } = require('../src/common/lib/database/repositories/todoRepository.ts');
const { SyncQueue } = require('../src/common/lib/database/sync/syncQueue.ts');
const { SyncManager } = require('../src/common/lib/database/sync/syncManager.ts');
const { SyncConflictError } = require('../src/common/lib/database/sync/syncTypes.ts');
const { getRetryDelay } = require('../src/common/lib/database/sync/syncPolicy.ts');
const { createTodoSyncAdapter } = require('../src/common/lib/database/sync/createTodoSyncAdapter.ts');

async function fixture(t, filename) {
  const connection = new SQLiteConnection(filename);
  t.after(() => connection.close());
  await migrateDatabase(connection);
  const database = new LocalDatabase(async () => connection);
  let time = Date.parse('2026-10-30T10:00:00Z');
  const now = () => time;
  const todos = new TodoRepository(database, randomUUID, now);
  const queue = new SyncQueue(database);
  return { connection, database, todos, queue, now, advance: (ms) => { time += ms; } };
}

function managerFor(f, options = {}) {
  return new SyncManager(f.queue, {
    canSync: () => true, onChange: async () => {}, onRunning: () => {},
    onError: () => {}, onSuccess: () => {}, now: f.now, random: () => 0.5,
    ...options,
  });
}

function remote(id, title = 'Server task') {
  return { id, title, completed: false, createdAt: '2026-10-30T09:00:00Z', updatedAt: '2026-10-30T10:00:00Z', deletedAt: null };
}

test('migrations are repeatable and reject future schemas without resetting data', async (t) => {
  const f = await fixture(t);
  await f.todos.insert('Keep this task');
  await migrateDatabase(f.connection);
  assert.equal((await f.todos.getAll()).length, 1);
  await f.connection.execAsync('PRAGMA user_version = 99');
  await assert.rejects(migrateDatabase(f.connection), /newer version/);
  assert.equal((await f.todos.getAll())[0].title, 'Keep this task');
});

test('create, update, completion, and tombstone deletion persist ordered operation snapshots', async (t) => {
  const f = await fixture(t);
  const todo = await f.todos.insert('  Buy milk  ');
  assert.equal(todo.title, 'Buy milk');
  assert.match(todo.id, /^[\da-f-]{36}$/);
  await f.todos.update(todo.id, { title: 'Buy bread', completed: true });
  assert.equal((await f.todos.getById(todo.id)).completed, true);
  await f.todos.delete(todo.id);
  assert.equal(await f.todos.getById(todo.id), null);
  assert.deepEqual(await f.todos.getAll(), []);
  const rows = await f.connection.getAllAsync('SELECT * FROM sync_queue ORDER BY sequence');
  assert.deepEqual(rows.map((row) => row.operation), ['create', 'update', 'delete']);
  assert.equal(JSON.parse(rows[0].payload).title, 'Buy milk');
  assert.equal(JSON.parse(rows[1].payload).revision, 2);
  assert.equal(JSON.parse(rows[2].payload).revision, 3);
  assert.ok((await f.connection.getFirstAsync('SELECT deleted_at FROM todos')).deleted_at);
});

test('queue insertion failure rolls back the entity insert', async (t) => {
  const f = await fixture(t);
  await f.connection.execAsync("CREATE TRIGGER reject_queue BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT, 'queue rejected'); END;");
  await assert.rejects(f.todos.insert('Do not partially save'), /queue rejected/);
  assert.deepEqual(await f.todos.getAll(), []);
  assert.equal((await f.queue.summary()).pending, 0);
});

test('queue failure rolls back updates and deletes, and does not poison later transactions', async (t) => {
  const f = await fixture(t);
  const todo = await f.todos.insert('Original');
  await f.connection.execAsync("CREATE TRIGGER reject_queue BEFORE INSERT ON sync_queue BEGIN SELECT RAISE(ABORT, 'queue rejected'); END;");
  await assert.rejects(f.todos.update(todo.id, { title: 'Lost update' }), /queue rejected/);
  await assert.rejects(f.todos.delete(todo.id), /queue rejected/);
  assert.equal((await f.todos.getById(todo.id)).title, 'Original');
  assert.equal((await f.todos.getById(todo.id)).revision, 1);
  await f.connection.execAsync('DROP TRIGGER reject_queue');
  await f.todos.update(todo.id, { title: 'Saved later' });
  assert.equal((await f.todos.getById(todo.id)).title, 'Saved later');
});

test('concurrent local writes are serialized into independent transactions', async (t) => {
  const f = await fixture(t);
  await Promise.all(Array.from({ length: 20 }, (_, i) => f.todos.insert(`Task ${i}`)));
  assert.equal((await f.todos.getAll()).length, 20);
  assert.equal((await f.queue.summary()).pending, 20);
});

test('titles are validated and user strings cannot become SQL', async (t) => {
  const f = await fixture(t);
  assert.throws(() => f.todos.insert('   '));
  assert.throws(() => f.todos.insert('x'.repeat(201)));
  const title = "Robert'); DROP TABLE todos; --";
  await f.todos.insert(title);
  assert.equal((await f.todos.getAll())[0].title, title);
});

test('file-backed tasks and pending mutations survive closing and reopening SQLite', async (t) => {
  const directory = fs.mkdtempSync(path.join(process.cwd(), '.expo', 'offline-test-'));
  const filename = path.join(directory, 'offline.db');
  const f = await fixture(t, filename);
  const todo = await f.todos.insert('Survive restart');
  const operation = await f.queue.claimNext(f.now(), ['todo']);
  f.connection.close();
  const reopened = await fixture(t, filename);
  await reopened.queue.recoverInterrupted();
  assert.equal((await reopened.todos.getById(todo.id)).title, 'Survive restart');
  const retry = await reopened.queue.claimNext(reopened.now(), ['todo']);
  assert.equal(retry.id, operation.id);
  assert.deepEqual(retry.payload, operation.payload);
  reopened.connection.close();
  fs.unlinkSync(filename);
  fs.rmdirSync(directory);
});

test('backoff blocks later mutations of the same entity but permits independent entities', async (t) => {
  const f = await fixture(t);
  const first = await f.todos.insert('First');
  await f.todos.update(first.id, { title: 'First updated' });
  const other = await f.todos.insert('Other');
  const operation = await f.queue.claimNext(f.now(), ['todo']);
  await f.queue.fail(operation.id, 'Temporary failure', f.now() + 1_000);
  const independent = await f.queue.claimNext(f.now(), ['todo']);
  assert.equal(independent.entityId, other.id);
  await f.queue.complete(independent.id);
  assert.equal(await f.queue.claimNext(f.now(), ['todo']), null);
  f.advance(1_000);
  const retry = await f.queue.claimNext(f.now(), ['todo']);
  assert.equal(retry.id, operation.id);
  assert.equal(retry.retryCount, 1);
  assert.deepEqual(retry.payload, operation.payload);
  await f.queue.complete(retry.id);
  assert.equal((await f.queue.claimNext(f.now(), ['todo'])).operation, 'update');
});

test('disabled sync and absent adapters leave every operation pending', async (t) => {
  const f = await fixture(t);
  await f.todos.insert('Local only');
  let calls = 0;
  const disabled = managerFor(f, { canSync: () => false });
  disabled.register('todo', { push: async () => { calls++; } });
  await disabled.requestSync();
  await managerFor(f).requestSync();
  assert.equal(calls, 0);
  assert.equal((await f.queue.summary()).pending, 1);
  assert.equal((await f.connection.getFirstAsync('SELECT status FROM sync_queue')).status, 'pending');
});

test('a lost server response retries with the same operation ID, allowing backend deduplication', async (t) => {
  const f = await fixture(t);
  await f.todos.insert('Once on server');
  const applied = new Set();
  const received = [];
  const manager = managerFor(f);
  manager.register('todo', { push: async (operation, context) => {
    assert.equal(context.clientOperationId, operation.id);
    received.push(context.clientOperationId);
    if (!applied.has(operation.id)) {
      applied.add(operation.id);
      throw new Error('Response was lost after server committed');
    }
  } });
  await manager.requestSync();
  assert.equal((await f.queue.summary()).failed, 1);
  await manager.requestSync();
  assert.equal(received.length, 1, 'must not retry before backoff');
  f.advance(1_000);
  await manager.requestSync();
  assert.equal(received.length, 2);
  assert.equal(received[0], received[1]);
  assert.equal(applied.size, 1);
  assert.equal((await f.queue.summary()).pending, 0);
});

test('concurrent sync requests share a run and acknowledgement never overwrites a newer local edit', async (t) => {
  const f = await fixture(t);
  const todo = await f.todos.insert('Old title');
  let release;
  let started;
  const gate = new Promise((resolve) => { release = resolve; });
  const start = new Promise((resolve) => { started = resolve; });
  const titles = [];
  const manager = managerFor(f);
  manager.register('todo', { push: async (operation) => {
    titles.push(operation.payload.title);
    if (titles.length === 1) { started(); await gate; }
    else assert.equal((await f.todos.getById(todo.id)).title, 'New title');
  } });
  const firstRun = manager.requestSync();
  await start;
  await f.todos.update(todo.id, { title: 'New title' });
  const secondRun = manager.requestSync();
  assert.equal(firstRun, secondRun);
  release();
  await firstRun;
  assert.deepEqual(titles, ['Old title', 'New title']);
  assert.equal((await f.todos.getById(todo.id)).title, 'New title');
  assert.equal((await f.todos.getById(todo.id)).syncState, 'synced');
});

test('server conflicts are retained and block only that entity', async (t) => {
  const f = await fixture(t);
  const todo = await f.todos.insert('Conflict');
  await f.todos.update(todo.id, { title: 'Local edit' });
  const other = await f.todos.insert('Independent');
  const pushed = [];
  const manager = managerFor(f);
  manager.register('todo', { push: async (operation) => {
    if (operation.entityId === todo.id) throw new SyncConflictError();
    pushed.push(operation.entityId);
  } });
  await manager.requestSync();
  await f.queue.retryFailed();
  await manager.requestSync();
  assert.deepEqual(pushed, [other.id]);
  assert.equal((await f.queue.summary()).conflicts, 1);
  assert.equal((await f.todos.getById(todo.id)).syncState, 'conflict');
  assert.equal((await f.connection.getFirstAsync("SELECT retry_count FROM sync_queue WHERE status = 'conflict'")).retry_count, 1);
});

test('remote changes and cursor are durable, while dirty local data is preserved for manual review', async (t) => {
  const f = await fixture(t);
  await f.todos.applyRemoteChanges([remote('remote-id', 'Server original')], 'cursor-1');
  assert.equal((await f.todos.getById('remote-id')).syncState, 'synced');
  await f.todos.update('remote-id', { title: 'Local title' });
  assert.equal(await f.todos.applyRemoteChanges([remote('remote-id', 'New remote title')], 'cursor-2'), 1);
  assert.equal((await f.todos.getById('remote-id')).title, 'Local title');
  assert.equal((await f.todos.getById('remote-id')).syncState, 'conflict');
  assert.equal(await f.todos.getSyncCursor(), 'cursor-2');
  assert.equal(await f.queue.claimNext(f.now(), ['todo']), null);
  const conflict = await f.connection.getFirstAsync('SELECT remote_payload FROM sync_conflicts');
  assert.equal(JSON.parse(conflict.remote_payload).title, 'New remote title');
});

test('a failed remote batch rolls back its earlier rows and cursor', async (t) => {
  const f = await fixture(t);
  await f.todos.applyRemoteChanges([], 'before');
  await f.connection.execAsync("CREATE TRIGGER reject_bad BEFORE INSERT ON todos WHEN NEW.id = 'bad' BEGIN SELECT RAISE(ABORT, 'bad remote row'); END;");
  await assert.rejects(f.todos.applyRemoteChanges([remote('good'), remote('bad')], 'after'), /bad remote row/);
  assert.deepEqual(await f.todos.getAll(), []);
  assert.equal(await f.todos.getSyncCursor(), 'before');
});

test('pull adapter uses the durable cursor and merges through the repository', async (t) => {
  const f = await fixture(t);
  await f.todos.applyRemoteChanges([], 'old-cursor');
  const adapter = createTodoSyncAdapter(f.todos, {
    push: async () => {},
    pull: async (cursor) => {
      assert.equal(cursor, 'old-cursor');
      return { changes: [remote('pulled')], cursor: 'new-cursor' };
    },
  });
  await adapter.pull({ signal: new AbortController().signal });
  assert.equal((await f.todos.getAll()).length, 1);
  assert.equal(await f.todos.getSyncCursor(), 'new-cursor');
});

test('React Query can read and commit SQLite mutations while offline', async (t) => {
  const f = await fixture(t);
  const client = new QueryClient();
  t.after(() => { client.clear(); onlineManager.setOnline(true); });
  onlineManager.setOnline(false);
  const mutation = client.getMutationCache().build(client, {
    mutationFn: (title) => f.todos.insert(title), networkMode: 'always', retry: false,
  });
  await mutation.execute('Airplane mode task');
  const todos = await client.fetchQuery({
    queryKey: ['offline-test'], queryFn: () => f.todos.getAll(), networkMode: 'always', retry: false,
  });
  assert.equal(todos[0].title, 'Airplane mode task');
  assert.equal((await f.queue.summary()).pending, 1);
});

test('retry backoff increases and remains bounded', () => {
  assert.equal(getRetryDelay(1, () => 0.5), 1_000);
  assert.equal(getRetryDelay(2, () => 0.5), 2_000);
  assert.equal(getRetryDelay(50, () => 1), 300_000);
});

test('losing connectivity during queue claiming releases the operation without sending it', async (t) => {
  const f = await fixture(t);
  await f.todos.insert('Do not send after disconnect');
  let online = true;
  let calls = 0;
  const originalClaim = f.queue.claimNext.bind(f.queue);
  f.queue.claimNext = async (...args) => {
    const operation = await originalClaim(...args);
    online = false;
    return operation;
  };
  const manager = managerFor(f, { canSync: () => online });
  manager.register('todo', { push: async () => { calls++; } });
  await manager.requestSync();
  assert.equal(calls, 0);
  const row = await f.connection.getFirstAsync('SELECT status, retry_count FROM sync_queue');
  assert.equal(row.status, 'pending');
  assert.equal(row.retry_count, 0);
});

test('cancelling an active pass retains its operation and stops subsequent sends', async (t) => {
  const f = await fixture(t);
  await f.todos.insert('First task');
  await f.todos.insert('Second task');
  let online = true;
  let started;
  const start = new Promise((resolve) => { started = resolve; });
  let calls = 0;
  const manager = managerFor(f, { canSync: () => online });
  manager.register('todo', { push: async (_operation, { signal }) => {
    calls++;
    started();
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
  } });
  const run = manager.requestSync();
  await start;
  online = false;
  manager.cancel();
  await run;
  assert.equal(calls, 1);
  assert.equal((await f.queue.summary()).pending, 2);
  assert.equal((await f.queue.summary()).failed, 1);
  assert.equal((await f.connection.getFirstAsync("SELECT count(*) AS count FROM sync_queue WHERE status = 'syncing'")).count, 0);
});
