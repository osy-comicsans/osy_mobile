import { TodosView } from '../components/TodosView';
import { useTodosController } from '../hooks/useTodosController';

export function TodosScreen() {
  const controller = useTodosController();
  return <TodosView controller={controller} />;
}
