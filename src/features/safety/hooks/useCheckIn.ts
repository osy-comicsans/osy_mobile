import { useContext } from 'react';
import { useStore } from 'zustand';

import { CheckInContext } from '../providers/CheckInProvider';

export function useCheckInService() {
  const service = useContext(CheckInContext);
  if (!service) throw new Error('Check-in hooks require CheckInProvider.');
  return service;
}

export function useCheckInState() {
  return useStore(useCheckInService().store);
}
