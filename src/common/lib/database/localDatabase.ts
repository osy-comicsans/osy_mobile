import type { DatabaseConnection, DatabaseTask } from './databaseTypes';

// Every repository uses this executor, including reads. No unrelated query can
// accidentally join another operation's asynchronous SQLite transaction.
export class LocalDatabase {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly connect: () => Promise<DatabaseConnection>) {}

  read<T>(task: DatabaseTask<T>): Promise<T> {
    return this.enqueue(task);
  }

  write<T>(task: DatabaseTask<T>): Promise<T> {
    return this.enqueue(async (database) => {
      let result: T;
      await database.withTransactionAsync(async () => {
        result = await task(database);
      });
      return result!;
    });
  }

  private enqueue<T>(task: DatabaseTask<T>): Promise<T> {
    const result = this.tail.then(async () => task(await this.connect()));
    this.tail = result.catch(() => undefined);
    return result;
  }
}
