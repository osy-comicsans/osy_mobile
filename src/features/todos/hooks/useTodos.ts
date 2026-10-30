import { useQuery } from '@tanstack/react-query';

import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';

export function useTodos() {
  const runtime = useOfflineRuntime();
  const { ready, supported } = useOfflineStatus();
  return useQuery({
    queryKey: ['local', 'todos'],
    queryFn: () => runtime.todos.getAll(),
    enabled: supported && ready,
    // SQLite reads must run even when onlineManager reports airplane mode.
    networkMode: 'always',
    staleTime: Infinity,
  });
}
