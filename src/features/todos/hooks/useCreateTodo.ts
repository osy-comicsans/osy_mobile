import { useMutation } from '@tanstack/react-query';

import { useOfflineRuntime } from '@/common/hooks/use-offline';

export function useCreateTodo() {
  const runtime = useOfflineRuntime();
  return useMutation({
    mutationKey: ['local', 'todos'],
    mutationFn: (title: string) => runtime.todos.insert(title),
    networkMode: 'always',
    onSuccess: () => {
      void runtime.changed();
      void runtime.sync.requestSync();
    },
  });
}
