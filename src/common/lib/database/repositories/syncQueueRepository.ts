import type { DatabaseConnection } from '../databaseTypes';
import type { LocalDatabase } from '../localDatabase';
import type { QueueSummary, SyncOperation, SyncOperationType, SyncStatus } from '../sync/syncTypes';

interface OperationRow {
  sequence: number;
  id: string;
  entity: string;
  entity_id: string;
  operation: SyncOperationType;
  payload: string;
  created_at: string;
  retry_count: number;
  last_error: string | null;
  status: SyncStatus;
  next_attempt_at: number;
}

export async function enqueueOperation(
  database: DatabaseConnection,
  operation: Omit<SyncOperation, 'sequence' | 'retryCount' | 'lastError' | 'status' | 'nextAttemptAt'>,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO sync_queue (id, entity, entity_id, operation, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    operation.id, operation.entity, operation.entityId, operation.operation,
    JSON.stringify(operation.payload), operation.createdAt,
  );
}

export class SyncQueue {
  constructor(private readonly database: LocalDatabase) {}

  recoverInterrupted(): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync("UPDATE sync_queue SET status = 'pending', next_attempt_at = 0 WHERE status = 'syncing'");
    });
  }

  claimNext(now: number, entities: string[]): Promise<SyncOperation | null> {
    if (entities.length === 0) return Promise.resolve(null);
    return this.database.write(async (db) => {
      const row = await db.getFirstAsync<OperationRow>(
        `SELECT q.* FROM sync_queue q
         WHERE q.status IN ('pending', 'failed') AND q.next_attempt_at <= ?
           AND q.entity IN (${entities.map(() => '?').join(',')})
           AND NOT EXISTS (
             SELECT 1 FROM sync_queue earlier
             WHERE earlier.entity = q.entity AND earlier.entity_id = q.entity_id
               AND earlier.sequence < q.sequence AND earlier.status != 'completed'
           )
           AND NOT EXISTS (
             SELECT 1 FROM sync_conflicts c WHERE c.entity = q.entity AND c.entity_id = q.entity_id
           )
         ORDER BY q.sequence LIMIT 1`,
        now, ...entities,
      );
      if (!row) return null;
      await db.runAsync("UPDATE sync_queue SET status = 'syncing' WHERE id = ?", row.id);
      return {
        sequence: row.sequence, id: row.id, entity: row.entity, entityId: row.entity_id,
        operation: row.operation, payload: JSON.parse(row.payload), createdAt: row.created_at,
        retryCount: row.retry_count, lastError: row.last_error, status: 'syncing',
        nextAttemptAt: row.next_attempt_at,
      };
    });
  }

  complete(id: string): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync(
        "UPDATE sync_queue SET status = 'completed', last_error = NULL WHERE id = ? AND status = 'syncing'", id,
      );
    });
  }

  release(id: string): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync("UPDATE sync_queue SET status = 'pending' WHERE id = ? AND status = 'syncing'", id);
    });
  }

  fail(id: string, error: string, nextAttemptAt: number, conflict = false): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync(
        `UPDATE sync_queue SET status = ?, retry_count = retry_count + 1,
         last_error = ?, next_attempt_at = ? WHERE id = ? AND status = 'syncing'`,
        conflict ? 'conflict' : 'failed', error, nextAttemptAt, id,
      );
    });
  }

  retryFailed(): Promise<void> {
    return this.database.write(async (db) => {
      // Payload and operation ID never change, including after a manual retry.
      await db.runAsync("UPDATE sync_queue SET next_attempt_at = 0 WHERE status = 'failed'");
    });
  }

  summary(): Promise<QueueSummary> {
    return this.database.read(async (db) => {
      const counts = await db.getFirstAsync<{ pending: number; failed: number }>(
        `SELECT count(*) AS pending,
         coalesce(sum(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed
         FROM sync_queue WHERE status IN ('pending', 'failed', 'syncing')`,
      );
      const conflicts = await db.getFirstAsync<{ count: number }>(
        `SELECT count(*) AS count FROM (
           SELECT entity, entity_id FROM sync_queue WHERE status = 'conflict'
           UNION SELECT entity, entity_id FROM sync_conflicts
         )`,
      );
      return { pending: counts?.pending ?? 0, failed: counts?.failed ?? 0, conflicts: conflicts?.count ?? 0 };
    });
  }
}
