import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { createOfflineRuntime, type OfflineRuntime } from '@/common/lib/database/offlineRuntime';
import { subscribeToForeground } from '@/common/lib/native/appLifecycle';
import { subscribeToConnectivity } from '@/common/lib/network/connectivity';

export const OfflineContext = createContext<OfflineRuntime | null>(null);

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }));
  const [runtime] = useState(createOfflineRuntime);

  useEffect(() => {
    if (!runtime.status.getState().supported) return;

    // Register real backend adapters here when transport and authentication exist.
    runtime.start(() => queryClient.invalidateQueries({ queryKey: ['local'] }));
    const unsubscribeNetwork = subscribeToConnectivity((online) => {
      onlineManager.setOnline(online);
      runtime.setOnline(online);
    });
    const unsubscribeForeground = subscribeToForeground((active) => {
      focusManager.setFocused(active);
      runtime.setForeground(active);
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeForeground();
      runtime.stop();
    };
  }, [queryClient, runtime]);

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineContext value={runtime}>{children}</OfflineContext>
    </QueryClientProvider>
  );
}
