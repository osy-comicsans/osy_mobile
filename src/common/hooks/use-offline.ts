import { useContext } from 'react';
import { useStore } from 'zustand';

import { OfflineContext } from '@/common/providers/AppProviders';

export function useOfflineRuntime() {
  const runtime = useContext(OfflineContext);
  if (!runtime) throw new Error('Offline hooks require AppProviders.');
  return runtime;
}

export function useOfflineStatus() {
  const runtime = useOfflineRuntime();
  return useStore(runtime.status);
}
