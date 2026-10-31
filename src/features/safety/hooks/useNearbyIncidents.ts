import { useStore } from 'zustand';

import { nearbyIncidents } from '../nearbyServices';

export function useNearbyIncidents() {
  return useStore(nearbyIncidents.store, (state) => state.incidents);
}

export function useNearbyIncident(id: string | undefined) {
  return useStore(nearbyIncidents.store, (state) => state.incidents.find((incident) => incident.id === id) ?? null);
}
