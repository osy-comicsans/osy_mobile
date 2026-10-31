import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useLocationService } from '@/features/location/hooks/useLocation';

import { classifyCrash } from '../native/crashModelRuntime';
import { crashSensorDriver } from '../native/crashSensorDriver';
import { createCrashDetectionService, type CrashDetectionService } from '../utils/crashDetectionService';

export const CrashDetectionContext = createContext<CrashDetectionService | null>(null);

export function CrashDetectionProvider({ children }: PropsWithChildren) {
  const location = useLocationService();
  const [service] = useState(() => createCrashDetectionService(crashSensorDriver, location.store, Date.now, classifyCrash));

  useEffect(() => {
    service.start();
    return service.stop;
  }, [service]);

  return <CrashDetectionContext value={service}>{children}</CrashDetectionContext>;
}
