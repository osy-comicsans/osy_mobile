import type { BackgroundDriver } from '../types/location.types';

// The web has no background location.
export const backgroundDriver: BackgroundDriver = {
  available: async () => false,
  getPermission: async () => 'unavailable',
  requestPermission: async () => 'unavailable',
  start: async () => undefined,
  stop: async () => undefined,
};
