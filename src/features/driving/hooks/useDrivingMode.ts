import { useContext } from 'react';
import { useStore } from 'zustand';

import { DrivingModeContext } from '../providers/DrivingModeProvider';
import { monitoringEnabled } from '../utils/drivingModeService';

export function useDrivingModeService() {
  const service = useContext(DrivingModeContext);
  if (!service) throw new Error('Driving mode requires DrivingModeProvider.');
  return service;
}

export function useDrivingMode() {
  return useStore(useDrivingModeService().store);
}

export function useMonitoringEnabled() {
  return useStore(useDrivingModeService().store, monitoringEnabled);
}
