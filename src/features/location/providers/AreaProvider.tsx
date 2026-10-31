import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { reverseGeocodeArea } from '@/common/lib/native/geocoding';
import { useLocationService } from '../hooks/useLocation';
import { createAreaService, type AreaService } from '../utils/areaService';

export const AreaContext = createContext<AreaService | null>(null);

export function AreaProvider({ children }: PropsWithChildren) {
  const runtime = useOfflineRuntime();
  const { online, foreground, supported } = useOfflineStatus();
  const location = useLocationService();
  const [service] = useState(() => createAreaService(location.store, runtime.areas, reverseGeocodeArea));
  useEffect(() => { service.setOnline(online === true); }, [online, service]);
  useEffect(() => {
    if (foreground && supported) service.start();
    else service.stop();
    return service.stop;
  }, [foreground, service, supported]);
  return <AreaContext value={service}>{children}</AreaContext>;
}
