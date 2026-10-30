import type { TodosTransport } from '../../../../features/todos/api/todosApi';
import type { TodoRepository } from '../repositories/todoRepository';
import type { SyncAdapter } from './syncTypes';

export function createTodoSyncAdapter(repository: TodoRepository, transport: TodosTransport): SyncAdapter {
  const adapter: SyncAdapter = {
    push: (operation, context) => transport.push(operation, context),
  };
  const pull = transport.pull?.bind(transport);
  if (pull) {
    adapter.pull = async (context) => {
      const cursor = await repository.getSyncCursor();
      const result = await pull(cursor, context);
      await repository.applyRemoteChanges(result.changes, result.cursor);
    };
  }
  return adapter;
}
