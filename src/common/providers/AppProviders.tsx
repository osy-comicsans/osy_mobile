import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { authSession } from '@/common/lib/api/axios';
import { createOfflineRuntime, type OfflineRuntime } from '@/common/lib/database/offlineRuntime';
import { refreshDeviceLanguage } from '@/common/lib/i18n/i18n';
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

    // Register real backend adapters here when their endpoints exist.
    runtime.start(() => queryClient.invalidateQueries({ queryKey: ['local'] }));
    const unsubscribeNetwork = subscribeToConnectivity((online) => {
      onlineManager.setOnline(online);
      runtime.setOnline(online);
    });
    const unsubscribeForeground = subscribeToForeground((active) => {
      focusManager.setFocused(active);
      runtime.setForeground(active);
      if (active) refreshDeviceLanguage();
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeForeground();
      runtime.stop();
    };
  }, [queryClient, runtime]);

  useEffect(() => {
    const applyStatus = () => runtime.setAuthenticated(authSession.status.getState().status === 'signedIn');
    const unsubscribe = authSession.status.subscribe(applyStatus);
    applyStatus();
    void authSession.restore();
    return unsubscribe;
  }, [runtime]);

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineContext value={runtime}>{children}</OfflineContext>
    </QueryClientProvider>
  );
}
