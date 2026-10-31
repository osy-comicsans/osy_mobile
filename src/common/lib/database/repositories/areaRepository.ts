import { areaSnapshotSchema, type AreaSnapshot } from '../../../../features/location/types/area.types';
import { areaPolicy } from '../../../../features/location/utils/areaPolicy';
import type { LocalDatabase } from '../localDatabase';

export class AreaRepository {
  constructor(private readonly database: LocalDatabase, private readonly now: () => number = Date.now) {}

  async read(key: string): Promise<AreaSnapshot | null> {
    return this.database.read(async (db) => {
      const row = await db.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM location_areas WHERE area_key = ? AND updated_at >= ?', key, this.now() - areaPolicy.retentionMs,
      );
      if (!row) return null;
      try {
        const parsed = areaSnapshotSchema.safeParse(JSON.parse(row.payload));
        return parsed.success && parsed.data.key === key ? parsed.data : null;
      } catch { return null; }
    });
  }

  async save(value: AreaSnapshot) {
    const area = areaSnapshotSchema.parse(value);
    await this.database.write(async (db) => {
      await db.runAsync(`INSERT INTO location_areas (area_key, updated_at, payload) VALUES (?, ?, ?)
        ON CONFLICT(area_key) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload
        WHERE excluded.updated_at >= location_areas.updated_at`, area.key, area.updatedAt, JSON.stringify(area));
      await db.runAsync('DELETE FROM location_areas WHERE updated_at < ?', this.now() - areaPolicy.retentionMs);
      await db.runAsync('DELETE FROM location_areas WHERE area_key NOT IN (SELECT area_key FROM location_areas ORDER BY updated_at DESC LIMIT 60)');
    });
  }
}
