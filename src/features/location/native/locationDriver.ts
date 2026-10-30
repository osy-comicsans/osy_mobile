import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

import type { LocationDriver, MotionPermission, PermissionSummary } from '../types/location.types';
import { toLocationPermission } from '../utils/location.utils';

const accuracies = {
  high: Location.Accuracy.High,
  navigation: Location.Accuracy.BestForNavigation,
} as const;

const toPermission = (response: Location.LocationPermissionResponse): PermissionSummary => ({
  location: toLocationPermission(response),
  canAskAgain: response.canAskAgain,
});

const toMotion = ({ granted, status }: { granted: boolean; status: string }): MotionPermission => {
  if (granted) return 'granted';
  return status === 'denied' ? 'denied' : 'undetermined';
};

export const locationDriver: LocationDriver = {
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  getPermission: async () => toPermission(await Location.getForegroundPermissionsAsync()),
  requestPermission: async () => toPermission(await Location.requestForegroundPermissionsAsync()),
  getMotionPermission: async () => {
    if (!(await DeviceMotion.isAvailableAsync())) return 'unavailable';
    return toMotion(await DeviceMotion.getPermissionsAsync());
  },
  requestMotionPermission: async () => toMotion(await DeviceMotion.requestPermissionsAsync()),
  watch: ({ accuracy, timeInterval, distanceInterval }, onLocation, onError) =>
    Location.watchPositionAsync(
      { accuracy: accuracies[accuracy], timeInterval, distanceInterval, mayShowUserSettingsDialog: false },
      onLocation,
      onError,
    ),
};
