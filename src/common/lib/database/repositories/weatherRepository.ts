import { weatherSnapshotSchema, type WeatherSnapshot } from '../../../../features/weather/types/weather.types';
import { weatherPolicy } from '../../../../features/weather/utils/weatherPolicy';
import type { LocalDatabase } from '../localDatabase';

export class WeatherRepository {
  constructor(private readonly database: LocalDatabase, private readonly now: () => number = Date.now) {}

  async read(areaId?: string): Promise<WeatherSnapshot | null> {
    return this.database.read(async (db) => {
      const row = areaId
        ? await db.getFirstAsync<{ payload: string }>('SELECT payload FROM weather_cache WHERE area_id = ? AND fetched_at >= ?', areaId, this.now() - weatherPolicy.retentionMs)
        : await db.getFirstAsync<{ payload: string }>('SELECT payload FROM weather_cache WHERE fetched_at >= ? ORDER BY fetched_at DESC LIMIT 1', this.now() - weatherPolicy.retentionMs);
      if (!row) return null;
      try {
        const result = weatherSnapshotSchema.safeParse(JSON.parse(row.payload));
        return result.success && (!areaId || result.data.area.id === areaId) ? result.data : null;
      } catch { return null; }
    });
  }

  async save(value: WeatherSnapshot): Promise<void> {
    const snapshot = weatherSnapshotSchema.parse(value);
    await this.database.write(async (db) => {
      await db.runAsync(`INSERT INTO weather_cache (area_id, fetched_at, valid_at, payload) VALUES (?, ?, ?, ?)
        ON CONFLICT(area_id) DO UPDATE SET fetched_at = excluded.fetched_at, valid_at = excluded.valid_at, payload = excluded.payload
        WHERE excluded.valid_at > weather_cache.valid_at
          OR (excluded.valid_at = weather_cache.valid_at AND excluded.fetched_at >= weather_cache.fetched_at)`,
      snapshot.area.id, Date.parse(snapshot.fetchedAt), Date.parse(snapshot.current.validAt), JSON.stringify(snapshot));
      await db.runAsync('DELETE FROM weather_cache WHERE fetched_at < ?', this.now() - weatherPolicy.retentionMs);
      await db.runAsync('DELETE FROM weather_cache WHERE area_id NOT IN (SELECT area_id FROM weather_cache ORDER BY fetched_at DESC LIMIT ?)', weatherPolicy.maxAreas);
    });
  }
}
