import type { SQLiteDatabase } from 'expo-sqlite';

// Web SQLite requires WASM and cross-origin isolation configuration. Keep the
// native database out of web bundles until web persistence is integrated.
export async function getDatabase(): Promise<SQLiteDatabase> {
  throw new Error('SQLite is configured for Android and iOS only. Web persistence is not set up.');
}
