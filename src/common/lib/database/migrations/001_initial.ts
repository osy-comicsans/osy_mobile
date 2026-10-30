export const initialSchema = `
CREATE TABLE todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE sync_queue (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'syncing', 'completed', 'failed', 'conflict')),
  next_attempt_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sync_queue_ready ON sync_queue(status, next_attempt_at, sequence);
CREATE INDEX sync_queue_entity ON sync_queue(entity, entity_id, sequence);
CREATE INDEX todos_visible ON todos(deleted_at, created_at);
CREATE TABLE sync_metadata (
  entity TEXT PRIMARY KEY NOT NULL,
  cursor TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE sync_conflicts (
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  remote_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(entity, entity_id)
);
`;
