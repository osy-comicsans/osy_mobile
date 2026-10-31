import { useContext } from 'react';
import { useStore } from 'zustand';

import { AreaContext } from '../providers/AreaProvider';

export function useCurrentArea() {
  const service = useContext(AreaContext);
  if (!service) throw new Error('Area hooks require AreaProvider.');
  return useStore(service.store);
}
