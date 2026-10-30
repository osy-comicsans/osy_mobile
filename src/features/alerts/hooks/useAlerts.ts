import { useContext } from 'react';
import { useStore } from 'zustand';

import { AlertContext } from '../providers/AlertProvider';

export function useAlertService() {
  const service = useContext(AlertContext);
  if (!service) throw new Error('Alert hooks require AlertProvider.');
  return service;
}

export function useAlertState() {
  return useStore(useAlertService().store);
}
