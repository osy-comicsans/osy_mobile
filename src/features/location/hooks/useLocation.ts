import { useContext } from 'react';
import { useStore } from 'zustand';

import { LocationContext } from '../providers/LocationProvider';

export function useLocationService() {
  const service = useContext(LocationContext);
  if (!service) throw new Error('Location hooks require LocationProvider.');
  return service;
}

export function useLocationState() {
  return useStore(useLocationService().store);
}

// The latest fix, kept after tracking stops. Check its timestamp if age matters.
export function useCurrentLocation() {
  return useStore(useLocationService().store, (state) => state.fix);
}

// Speed in km/h, or null when it is unknown or tracking has stopped.
export function useCurrentSpeed() {
  return useStore(useLocationService().store, (state) =>
    state.status === 'watching' ? (state.fix?.speedKmh ?? null) : null);
}

export function useDrivingState() {
  return useStore(useLocationService().store, (state) => state.drivingState);
}
