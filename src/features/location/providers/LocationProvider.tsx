import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { subscribeToForeground } from '@/common/lib/native/appLifecycle';

import { locationDriver } from '../native/locationDriver';
import { createLocationService, type LocationService } from '../utils/locationService';

export const LocationContext = createContext<LocationService | null>(null);

export function LocationProvider({ children }: PropsWithChildren) {
  const [service] = useState(() => createLocationService(locationDriver));

  useEffect(() => {
    const unsubscribe = subscribeToForeground((active) => {
      if (active) void service.enterForeground();
      else void service.enterBackground();
    });
    return () => {
      unsubscribe();
      service.stop();
    };
  }, [service]);

  return <LocationContext value={service}>{children}</LocationContext>;
}
