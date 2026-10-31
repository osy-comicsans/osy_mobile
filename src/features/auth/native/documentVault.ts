import { getRandomBytes } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { secureStorage } from '@/common/lib/storage/secureStorage';

import type { DocumentFields, DocumentType } from '../types/auth.schemas';

const KEY_NAME = 'osy.documents.key';

async function encryptionKey(): Promise<string> {
  const saved = await secureStorage.getItem(KEY_NAME);
  if (saved) return saved;
  const key = Array.from(getRandomBytes(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
  await secureStorage.setItem(KEY_NAME, key);
  return key;
}

// Skipped where SQLCipher is missing, such as Expo Go, so nothing is stored in the clear.
async function withVault<T>(work: (database: SQLiteDatabase) => Promise<T>): Promise<T | null> {
  const database = await openDatabaseAsync('documents.db');
  try {
    if (!await database.getFirstAsync('PRAGMA cipher_version')) return null;
    await database.execAsync(`PRAGMA key = "x'${await encryptionKey()}'"`);
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS confirmed_documents (type TEXT PRIMARY KEY, fields TEXT NOT NULL, capture_language TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS confirmed_vehicles (owner TEXT PRIMARY KEY, fields TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
    return await work(database);
  } finally {
    await database.closeAsync();
  }
}

export async function saveConfirmedFields(type: DocumentType, fields: DocumentFields, captureLanguage: string) {
  await withVault((database) => database.runAsync(
    'INSERT OR REPLACE INTO confirmed_documents (type, fields, capture_language, updated_at) VALUES (?, ?, ?, ?)',
    type, JSON.stringify(fields), captureLanguage, Date.now(),
  ));
}

// Kept per account, so a shared phone never shows one person's plate to another.
export async function saveVehicle(owner: string, fields: DocumentFields) {
  await withVault((database) => database.runAsync(
    'INSERT OR REPLACE INTO confirmed_vehicles (owner, fields, updated_at) VALUES (?, ?, ?)',
    owner, JSON.stringify(fields), Date.now(),
  ));
}

export async function readVehicle(owner: string): Promise<DocumentFields | null> {
  const row = await withVault((database) => database.getFirstAsync<{ fields: string }>(
    'SELECT fields FROM confirmed_vehicles WHERE owner = ?', owner,
  ));
  return row ? JSON.parse(row.fields) as DocumentFields : null;
}

export async function clearVehicle(owner: string) {
  await withVault((database) => database.runAsync('DELETE FROM confirmed_vehicles WHERE owner = ?', owner));
}
