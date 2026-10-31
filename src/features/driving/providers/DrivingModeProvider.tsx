import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { preferenceStorage } from '@/common/lib/storage/preferenceStorage';

import { createDrivingModeService, type DrivingModeService } from '../utils/drivingModeService';

export const DrivingModeContext = createContext<DrivingModeService | null>(null);

export function DrivingModeProvider({ children }: PropsWithChildren) {
  const [service] = useState(() => createDrivingModeService(preferenceStorage));
  useEffect(() => { void service.start(); return () => service.stop(); }, [service]);
  return <DrivingModeContext value={service}>{children}</DrivingModeContext>;
}
