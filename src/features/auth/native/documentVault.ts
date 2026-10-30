import { getRandomBytes } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';

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
export async function saveConfirmedFields(type: DocumentType, fields: DocumentFields, captureLanguage: string) {
  const database = await openDatabaseAsync('documents.db');
  try {
    if (!await database.getFirstAsync('PRAGMA cipher_version')) return;
    await database.execAsync(`PRAGMA key = "x'${await encryptionKey()}'"`);
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS confirmed_documents (type TEXT PRIMARY KEY, fields TEXT NOT NULL, capture_language TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
    await database.runAsync(
      'INSERT OR REPLACE INTO confirmed_documents (type, fields, capture_language, updated_at) VALUES (?, ?, ?, ?)',
      type, JSON.stringify(fields), captureLanguage, Date.now(),
    );
  } finally {
    await database.closeAsync();
  }
}
