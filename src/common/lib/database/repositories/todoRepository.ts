import { remoteTodoSchema, todoTitleSchema, type RemoteTodo, type Todo, type TodoSyncState, type TodoUpdate } from '../../../../features/todos/types/todo';
import type { DatabaseConnection } from '../databaseTypes';
import type { LocalDatabase } from '../localDatabase';
import { enqueueOperation } from '../sync/syncQueue';
import type { SyncOperationType } from '../sync/syncTypes';

interface TodoRow {
  id: string;
  title: string;
  completed: number;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_state?: TodoSyncState;
}

const selectTodos = `SELECT t.*,
  CASE
    WHEN EXISTS (SELECT 1 FROM sync_conflicts c WHERE c.entity = 'todo' AND c.entity_id = t.id)
      OR EXISTS (SELECT 1 FROM sync_queue q WHERE q.entity = 'todo' AND q.entity_id = t.id AND q.status = 'conflict') THEN 'conflict'
    WHEN EXISTS (SELECT 1 FROM sync_queue q WHERE q.entity = 'todo' AND q.entity_id = t.id AND q.status = 'failed') THEN 'failed'
    WHEN EXISTS (SELECT 1 FROM sync_queue q WHERE q.entity = 'todo' AND q.entity_id = t.id AND q.status != 'completed') THEN 'pending'
    ELSE 'synced'
  END AS sync_state
  FROM todos t`;

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id, title: row.title, completed: row.completed === 1, revision: row.revision,
    createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at,
    syncState: row.sync_state ?? 'pending',
  };
}

export class TodoRepository {
  constructor(
    private readonly database: LocalDatabase,
    private readonly createId: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  getAll(): Promise<Todo[]> {
    return this.database.read(async (db) => {
      const rows = await db.getAllAsync<TodoRow>(`${selectTodos} WHERE t.deleted_at IS NULL ORDER BY t.created_at DESC, t.id`);
      return rows.map(toTodo);
    });
  }

  getById(id: string): Promise<Todo | null> {
    return this.database.read(async (db) => {
      const row = await db.getFirstAsync<TodoRow>(`${selectTodos} WHERE t.id = ? AND t.deleted_at IS NULL`, id);
      return row ? toTodo(row) : null;
    });
  }

  insert(title: string): Promise<Todo> {
    const validTitle = todoTitleSchema.parse(title);
    return this.database.write(async (db) => {
      const timestamp = new Date(this.now()).toISOString();
      const todo: Todo = {
        id: this.createId(), title: validTitle, completed: false, revision: 1,
        createdAt: timestamp, updatedAt: timestamp, deletedAt: null, syncState: 'pending',
      };
      await db.runAsync(
        'INSERT INTO todos (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
        todo.id, todo.title, timestamp, timestamp,
      );
      await this.enqueue(db, todo, 'create');
      return todo;
    });
  }

  update(id: string, patch: TodoUpdate): Promise<Todo> {
    return this.database.write(async (db) => {
      const row = await this.requireTodo(db, id);
      const todo = toTodo(row);
      const title = todoTitleSchema.parse(patch.title ?? todo.title);
      const completed = patch.completed ?? todo.completed;
      if (title === todo.title && completed === todo.completed) return todo;
      const updated: Todo = {
        ...todo, title, completed, revision: todo.revision + 1,
        updatedAt: new Date(this.now()).toISOString(), syncState: todo.syncState === 'conflict' ? 'conflict' : 'pending',
      };
      await db.runAsync(
        'UPDATE todos SET title = ?, completed = ?, revision = ?, updated_at = ? WHERE id = ?',
        updated.title, updated.completed ? 1 : 0, updated.revision, updated.updatedAt, id,
      );
      await this.enqueue(db, updated, 'update');
      return updated;
    });
  }

  delete(id: string): Promise<void> {
    return this.database.write(async (db) => {
      const todo = toTodo(await this.requireTodo(db, id));
      const timestamp = new Date(this.now()).toISOString();
      const deleted = { ...todo, deletedAt: timestamp, updatedAt: timestamp, revision: todo.revision + 1 };
      await db.runAsync(
        'UPDATE todos SET deleted_at = ?, updated_at = ?, revision = ? WHERE id = ?',
        timestamp, timestamp, deleted.revision, id,
      );
      await this.enqueue(db, deleted, 'delete');
    });
  }

  getSyncCursor(): Promise<string | null> {
    return this.database.read(async (db) => {
      const row = await db.getFirstAsync<{ cursor: string | null }>("SELECT cursor FROM sync_metadata WHERE entity = 'todo'");
      return row?.cursor ?? null;
    });
  }

  // Manual conflict policy: never overwrite a locally changed entity. Preserve
  // the remote snapshot for review; commit the cursor with the whole batch.
  applyRemoteChanges(changes: RemoteTodo[], cursor: string | null): Promise<number> {
    const validChanges = changes.map((change) => remoteTodoSchema.parse(change));
    return this.database.write(async (db) => {
      let conflicts = 0;
      const timestamp = new Date(this.now()).toISOString();
      for (const todo of validChanges) {
        const dirty = await db.getFirstAsync<{ dirty: number }>(
          `SELECT 1 AS dirty WHERE
           EXISTS (SELECT 1 FROM sync_queue WHERE entity = 'todo' AND entity_id = ? AND status != 'completed')
           OR EXISTS (SELECT 1 FROM sync_conflicts WHERE entity = 'todo' AND entity_id = ?)`,
          todo.id, todo.id,
        );
        if (dirty) {
          await db.runAsync(
            `INSERT INTO sync_conflicts (entity, entity_id, remote_payload, created_at) VALUES ('todo', ?, ?, ?)
             ON CONFLICT(entity, entity_id) DO UPDATE SET remote_payload = excluded.remote_payload, created_at = excluded.created_at`,
            todo.id, JSON.stringify(todo), timestamp,
          );
          conflicts++;
          continue;
        }
        await db.runAsync(
          `INSERT INTO todos (id, title, completed, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title = excluded.title, completed = excluded.completed,
             updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, revision = todos.revision + 1`,
          todo.id, todo.title, todo.completed ? 1 : 0, todo.createdAt, todo.updatedAt, todo.deletedAt,
        );
      }
      await db.runAsync(
        `INSERT INTO sync_metadata (entity, cursor, updated_at) VALUES ('todo', ?, ?)
         ON CONFLICT(entity) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
        cursor, timestamp,
      );
      return conflicts;
    });
  }

  private async requireTodo(db: DatabaseConnection, id: string): Promise<TodoRow> {
    const row = await db.getFirstAsync<TodoRow>(`${selectTodos} WHERE t.id = ? AND t.deleted_at IS NULL`, id);
    if (!row) throw new Error('This task no longer exists.');
    return row;
  }

  private enqueue(db: DatabaseConnection, todo: Todo, operation: SyncOperationType): Promise<void> {
    const { syncState: _syncState, ...payload } = todo;
    return enqueueOperation(db, {
      id: this.createId(), entity: 'todo', entityId: todo.id,
      operation, payload, createdAt: todo.updatedAt,
    });
  }
}
