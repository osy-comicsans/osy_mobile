import type { SQLiteDatabase } from 'expo-sqlite';

export type DatabaseConnection = Pick<
  SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'
>;

export type DatabaseTask<T> = (database: DatabaseConnection) => Promise<T>;
