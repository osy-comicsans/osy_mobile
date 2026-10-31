import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { api, authSession } from '@/common/lib/api/axios';
import { createOfflineRuntime, type OfflineRuntime } from '@/common/lib/database/offlineRuntime';
import { ACCIDENT_REPORT_ENTITY } from '@/common/lib/database/repositories/accidentReportRepository';
import { createAccidentReportSyncAdapter } from '@/common/lib/database/sync/createAccidentReportSyncAdapter';
import { refreshDeviceLanguage } from '@/common/lib/i18n/i18n';
import { subscribeToForeground } from '@/common/lib/native/appLifecycle';
import { subscribeToConnectivity } from '@/common/lib/network/connectivity';
import { createSafetyApi } from '@/features/safety/api/safetyApi';
import { reportPhotos } from '@/features/safety/native/reportPhotos';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { settingsService } from '@/features/settings/settingsService';
import { defaultSettings } from '@/features/settings/types/settings.types';

export const OfflineContext = createContext<OfflineRuntime | null>(null);

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }));
  const [runtime] = useState(() => createOfflineRuntime({
    async finishPrivacyReset(owner) {
      reportPhotos.clearAll();
      await profilePhotos.clearOwner(owner);
      await settingsService.update(defaultSettings);
    },
  }));

  useEffect(() => {
    if (runtime.status.getState().supported) {
      // Web keeps profile previews in memory; native platforms use SQLite.
      runtime.registerSyncAdapter(ACCIDENT_REPORT_ENTITY, createAccidentReportSyncAdapter(createSafetyApi(api), reportPhotos));
      runtime.start(() => queryClient.invalidateQueries({ queryKey: ['local'] }));
    }
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
