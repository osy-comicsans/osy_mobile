import { profileBundleSchema, type ProfileBundle } from '../../../../features/profile/types/profile.schemas';
import type { LocalDatabase } from '../localDatabase';

export interface ProfileCache { bundle: ProfileBundle; revision: number; dirty: boolean }
export class ProfileRepository {
  constructor(private readonly database: LocalDatabase) {}
  async read(userId: string): Promise<ProfileCache | null> {
    return this.database.read(async (db) => {
      const row = await db.getFirstAsync<{ payload: string; revision: number; dirty: number }>('SELECT * FROM profile_cache WHERE user_id = ?', userId);
      if (!row) return null;
      const bundle = profileBundleSchema.parse(JSON.parse(row.payload));
      if (bundle.profile.id !== userId) throw new Error('Profile owner mismatch.');
      return { bundle, revision: row.revision, dirty: row.dirty === 1 };
    });
  }
  async write(bundle: ProfileBundle, dirty: boolean) {
    const parsed = profileBundleSchema.parse(bundle);
    await this.database.write(async (db) => {
      await db.runAsync(`INSERT INTO profile_cache(user_id,payload,dirty,revision,updated_at) VALUES(?,?,?,1,?)
        ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,dirty=excluded.dirty,revision=profile_cache.revision+1,updated_at=excluded.updated_at
        WHERE excluded.dirty=1 OR profile_cache.dirty=0`,
      parsed.profile.id, JSON.stringify(parsed), dirty ? 1 : 0, Date.now());
    });
    return (await this.read(parsed.profile.id))!;
  }
  async acknowledge(userId: string, revision: number) {
    await this.database.write((db) => db.runAsync('UPDATE profile_cache SET dirty = 0 WHERE user_id = ? AND revision = ?', userId, revision).then(() => undefined));
  }
  // Clears an uploaded or missing photo but leaves the rest of the edit pending.
  async settlePhoto(userId: string, name: string, photoUrl: string | null) {
    await this.database.write(async (db) => {
      const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM profile_cache WHERE user_id = ?', userId);
      if (!row) return;
      const bundle = profileBundleSchema.parse(JSON.parse(row.payload));
      if (bundle.pendingPhoto !== name) return;
      const settled = { ...bundle, pendingPhoto: null, profile: photoUrl ? { ...bundle.profile, photoUrl } : bundle.profile };
      await db.runAsync('UPDATE profile_cache SET payload = ? WHERE user_id = ?', JSON.stringify(settled), userId);
    });
  }
  // Replaces unsent edits with the server copy, unless a newer edit was saved meanwhile.
  async discard(revision: number, bundle: ProfileBundle) {
    const parsed = profileBundleSchema.parse(bundle);
    await this.database.write((db) => db.runAsync('UPDATE profile_cache SET payload = ?, dirty = 0, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?',
      JSON.stringify(parsed), Date.now(), parsed.profile.id, revision).then(() => undefined));
  }
  async remove(userId: string) {
    await this.database.write((db) => db.runAsync('DELETE FROM profile_cache WHERE user_id = ?', userId).then(() => undefined));
  }
  async purgePersonalData(userId: string) {
    await this.database.write(async (db) => {
      await db.runAsync('DELETE FROM profile_cache WHERE user_id = ?', userId);
      await db.runAsync('DELETE FROM trips WHERE owner = ?', userId);
      // Older device-local queues have no account column. Clear them on an
      // explicit data-erasure action so deleted data cannot be sent again.
      await db.execAsync('DELETE FROM sync_queue; DELETE FROM sync_conflicts; DELETE FROM sync_metadata; DELETE FROM todos; DELETE FROM weather_cache; DELETE FROM location_areas;');
    });
  }
}
