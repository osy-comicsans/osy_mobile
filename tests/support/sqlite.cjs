const fs = require('node:fs');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

// Exercise production TypeScript directly, with Node's real SQLite engine in
// place of the Expo native bridge. No SQL or repository behavior is mocked.
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

class SQLiteConnection {
  constructor(filename = ':memory:') {
    this.raw = new DatabaseSync(filename);
    this.closed = false;
  }

  async execAsync(sql) { this.raw.exec(sql); }
  async runAsync(sql, ...params) {
    const result = this.raw.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async getFirstAsync(sql, ...params) { return this.raw.prepare(sql).get(...params) ?? null; }
  async getAllAsync(sql, ...params) { return this.raw.prepare(sql).all(...params); }
  async withTransactionAsync(task) {
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      await task();
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }
  close() {
    if (!this.closed) this.raw.close();
    this.closed = true;
  }
}

module.exports = { SQLiteConnection };
