import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useLocationService } from '@/features/location/hooks/useLocation';
import { useDrivingModeService } from '@/features/driving/hooks/useDrivingMode';
import { bindMonitoring } from '@/features/driving/utils/bindMonitoring';

import { osrmApi } from '../api/osrmClient';
import { createRoadService, type RoadService } from '../utils/roadService';

export const RoadContext = createContext<RoadService | null>(null);

export function RoadProvider({ children }: PropsWithChildren) {
  const mode = useDrivingModeService();
  const location = useLocationService();
  const [service] = useState(() => createRoadService(osrmApi, location.store));

  useEffect(() => bindMonitoring(mode.store, service), [mode, service]);

  return <RoadContext value={service}>{children}</RoadContext>;
}
