import type { TripUpload } from '../../../../features/profile/types/profile.schemas';
import type { DatabaseConnection } from '../databaseTypes';
import type { LocalDatabase } from '../localDatabase';
import { enqueueOperation } from '../sync/syncQueue';

export const TRIP_ENTITY = 'trip';

export interface Trip {
  id: string;
  owner: string;
  startedAt: number;
  endedAt: number;
  distanceMeters: number;
  warnings: number;
}

// The owner stays on the phone: it binds the upload to the account that drove.
export type QueuedTrip = TripUpload & { owner: string };

export interface TripTotals {
  trips: number;
  distanceMeters: number;
  warnings: number;
}

interface TripRow {
  id: string;
  owner: string;
  started_at: number;
  ended_at: number;
  distance_meters: number;
  warnings: number;
}

const WAITING = "status IN ('pending', 'syncing', 'failed')";

export class TripRepository {
  constructor(
    private readonly database: LocalDatabase,
    private readonly createId: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  saveOpen(trip: Trip): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync(
        `INSERT OR REPLACE INTO trips (id, owner, started_at, ended_at, distance_meters, warnings)
         VALUES (?, ?, ?, ?, ?, ?)`,
        trip.id, trip.owner, trip.startedAt, trip.endedAt, trip.distanceMeters, trip.warnings,
      );
    });
  }

  // A trip worth keeping waits in the sync queue; a shorter one is dropped.
  finish(trip: Trip, keep: boolean): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync('DELETE FROM trips WHERE id = ?', trip.id);
      if (keep) await this.enqueue(db, trip);
    });
  }

  // The app closed during these trips, so they end at their last saved fix.
  finishAbandoned(keep: (trip: Trip) => boolean): Promise<void> {
    return this.database.write(async (db) => {
      const rows = await db.getAllAsync<TripRow>('SELECT * FROM trips');
      await db.runAsync('DELETE FROM trips');
      for (const row of rows) {
        const trip = {
          id: row.id, owner: row.owner, startedAt: row.started_at, endedAt: row.ended_at,
          distanceMeters: row.distance_meters, warnings: row.warnings,
        };
        if (keep(trip)) await this.enqueue(db, trip);
      }
    });
  }

  // Finished trips the server has not counted yet. A refused one never will be.
  waiting(owner: string): Promise<TripTotals> {
    return this.database.read(async (db) => {
      const totals = await db.getFirstAsync<TripTotals>(
        `SELECT count(*) AS trips,
         coalesce(sum(json_extract(payload, '$.distanceMeters')), 0) AS distanceMeters,
         coalesce(sum(json_extract(payload, '$.warnings')), 0) AS warnings
         FROM sync_queue WHERE entity = ? AND ${WAITING} AND json_extract(payload, '$.owner') = ?`,
        TRIP_ENTITY, owner,
      );
      return { trips: totals?.trips ?? 0, distanceMeters: totals?.distanceMeters ?? 0, warnings: totals?.warnings ?? 0 };
    });
  }

  // Signing out leaves none of the account's trips on the phone.
  discard(owner: string): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync('DELETE FROM trips WHERE owner = ?', owner);
      await db.runAsync("DELETE FROM sync_queue WHERE entity = ? AND json_extract(payload, '$.owner') = ?", TRIP_ENTITY, owner);
    });
  }

  // The server counts a delivered trip, so it does not stay on the phone.
  clearDelivered(): Promise<void> {
    return this.database.write(async (db) => {
      await db.runAsync("DELETE FROM sync_queue WHERE entity = ? AND status = 'completed'", TRIP_ENTITY);
    });
  }

  private async enqueue(db: DatabaseConnection, trip: Trip) {
    const payload: QueuedTrip = {
      owner: trip.owner, id: trip.id,
      startedAt: new Date(trip.startedAt).toISOString(), endedAt: new Date(trip.endedAt).toISOString(),
      distanceMeters: Math.round(trip.distanceMeters), warnings: trip.warnings,
    };
    await enqueueOperation(db, {
      id: this.createId(), entity: TRIP_ENTITY, entityId: trip.id, operation: 'create',
      payload: { ...payload }, createdAt: new Date(this.now()).toISOString(),
    });
  }
}
