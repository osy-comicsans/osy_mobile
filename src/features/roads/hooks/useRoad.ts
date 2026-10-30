import { useContext } from 'react';
import { useStore } from 'zustand';

import { RoadContext } from '../providers/RoadProvider';

// The current road, or null until one is matched. `stale` means it may be out of date.
export function useCurrentRoad() {
  const service = useContext(RoadContext);
  if (!service) throw new Error('Road hooks require RoadProvider.');
  return useStore(service.store);
}
