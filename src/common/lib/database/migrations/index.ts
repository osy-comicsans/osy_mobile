import type { DatabaseConnection } from '../databaseTypes';
import { initialSchema } from './001_initial';
import { weatherSchema } from './002_weather';
import { locationAreasSchema } from './003_location_areas';

const migrations = [
  { version: 1, sql: initialSchema }, { version: 2, sql: weatherSchema },
  { version: 3, sql: locationAreasSchema },
];

export async function migrateDatabase(database: DatabaseConnection): Promise<void> {
  await database.withTransactionAsync(async () => {
    const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const current = row?.user_version ?? 0;
    if (current > migrations[migrations.length - 1].version) {
      throw new Error('This database requires a newer version of the app.');
    }

    for (const migration of migrations) {
      if (migration.version > current) {
        await database.execAsync(migration.sql);
        await database.execAsync(`PRAGMA user_version = ${migration.version}`);
      }
    }
  });
}
