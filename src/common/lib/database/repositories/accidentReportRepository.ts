import type { IncidentRequest } from '../../../../features/safety/types/safety.schemas';
import type { LocalDatabase } from '../localDatabase';
import { enqueueOperation } from '../sync/syncQueue';

export const ACCIDENT_REPORT_ENTITY = 'accident_report';

export interface QueuedReportPhoto {
  photoName: string;
  mimeType: string;
}

// Reports live only in the sync queue: once sent, the app reads them from the
// server, so they need no table of their own. The photo is a second step, so a
// failed upload never sends the report twice.
export class AccidentReportRepository {
  constructor(
    private readonly database: LocalDatabase,
    private readonly createId: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  save(report: IncidentRequest, photo: QueuedReportPhoto | null): Promise<void> {
    return this.database.write(async (db) => {
      const createdAt = new Date(this.now()).toISOString();
      const entity = { entity: ACCIDENT_REPORT_ENTITY, entityId: report.id, createdAt };
      await enqueueOperation(db, { ...entity, id: this.createId(), operation: 'create', payload: { ...report } });
      if (photo) await enqueueOperation(db, { ...entity, id: this.createId(), operation: 'update', payload: { ...photo } });
    });
  }

  // Reports the queue will still send, newest first. A refused one never will.
  waiting(): Promise<IncidentRequest[]> {
    return this.database.read(async (db) => {
      const rows = await db.getAllAsync<{ payload: string }>(
        `SELECT payload FROM sync_queue WHERE entity = ? AND operation = 'create'
         AND status IN ('pending', 'syncing', 'failed') ORDER BY sequence DESC`,
        ACCIDENT_REPORT_ENTITY,
      );
      return rows.map(({ payload }) => JSON.parse(payload) as IncidentRequest);
    });
  }

  // A delivered report holds a location and a note, so it does not stay on the phone.
  clearDelivered(): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync("DELETE FROM sync_queue WHERE entity = ? AND status = 'completed'", ACCIDENT_REPORT_ENTITY);
    });
  }
}
