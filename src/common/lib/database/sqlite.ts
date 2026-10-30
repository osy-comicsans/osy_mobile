import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from './migrations';

let databasePromise: Promise<SQLiteDatabase> | undefined;

async function openDatabase(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync('osy.db');

  try {
    await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await migrateDatabase(database);
    return database;
  } catch (error) {
    await database.closeAsync().catch(() => undefined);
    throw error;
  }
}

// Open on first use. Concurrent callers share initialization; failed attempts
// may be retried instead of permanently caching a rejected promise.
export function getDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openDatabase().catch((error) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}
