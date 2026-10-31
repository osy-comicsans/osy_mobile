import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useLocationService } from '@/features/location/hooks/useLocation';
import { useDrivingModeService } from '@/features/driving/hooks/useDrivingMode';
import { bindMonitoring } from '@/features/driving/utils/bindMonitoring';
import { settingsService } from '@/features/settings/settingsService';
import { useSettings } from '@/features/settings/hooks/useSettings';

import { classifyCrash } from '../native/crashModelRuntime';
import { crashSensorDriver } from '../native/crashSensorDriver';
import { createCrashDetectionService, type CrashDetectionService } from '../utils/crashDetectionService';

export const CrashDetectionContext = createContext<CrashDetectionService | null>(null);

export function CrashDetectionProvider({ children }: PropsWithChildren) {
  const mode = useDrivingModeService();
  const location = useLocationService();
  const { ready, settings } = useSettings();
  const [service] = useState(() => createCrashDetectionService(crashSensorDriver, location.store, Date.now, classifyCrash,
    () => settingsService.store.getState().settings.sensitivity));

  useEffect(() => {
    if (!ready || !settings.crashDetection) { service.stop(); return; }
    return bindMonitoring(mode.store, service);
  }, [mode, ready, service, settings.crashDetection]);

  return <CrashDetectionContext value={service}>{children}</CrashDetectionContext>;
}
