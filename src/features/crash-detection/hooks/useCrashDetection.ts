import { useContext, useEffect } from 'react';

import { CrashDetectionContext } from '../providers/CrashDetectionProvider';
import type { CrashEvent } from '../types/crash.types';

export function useCrashDetectionService() {
  const service = useContext(CrashDetectionContext);
  if (!service) throw new Error('Crash detection hooks require CrashDetectionProvider.');
  return service;
}

// Calls the listener for every crashDetected event while the component is mounted.
export function useCrashDetected(listener: (event: CrashEvent) => void) {
  const service = useCrashDetectionService();
  useEffect(() => service.onCrashDetected(listener), [service, listener]);
}
