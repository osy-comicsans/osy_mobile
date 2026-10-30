import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useLocationService } from '@/features/location/hooks/useLocation';

import { osrmApi } from '../api/osrmClient';
import { createRoadService, type RoadService } from '../utils/roadService';

export const RoadContext = createContext<RoadService | null>(null);

export function RoadProvider({ children }: PropsWithChildren) {
  const location = useLocationService();
  const [service] = useState(() => createRoadService(osrmApi, location.store));

  useEffect(() => {
    service.start();
    return service.stop;
  }, [service]);

  return <RoadContext value={service}>{children}</RoadContext>;
}
