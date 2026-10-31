import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useLocationService } from '@/features/location/hooks/useLocation';
import { useDrivingModeService } from '@/features/driving/hooks/useDrivingMode';
import { bindMonitoring } from '@/features/driving/utils/bindMonitoring';

import { crashSensorDriver } from '../native/crashSensorDriver';
import { createCrashDetectionService, type CrashDetectionService } from '../utils/crashDetectionService';

export const CrashDetectionContext = createContext<CrashDetectionService | null>(null);

export function CrashDetectionProvider({ children }: PropsWithChildren) {
  const mode = useDrivingModeService();
  const location = useLocationService();
  const [service] = useState(() => createCrashDetectionService(crashSensorDriver, location.store));

  useEffect(() => bindMonitoring(mode.store, service), [mode, service]);

  return <CrashDetectionContext value={service}>{children}</CrashDetectionContext>;
}
