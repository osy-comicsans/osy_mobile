import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { i18n } from '@/common/lib/i18n/i18n';
import { Colors } from '@/common/lib/theme';
import { settingsService } from '@/features/settings/settingsService';

import type { BackgroundDriver, BackgroundPermission, RawLocation, SamplingProfile } from '../types/location.types';

const TASK = 'osy-background-location';

const accuracies = {
  balanced: Location.Accuracy.Balanced,
  high: Location.Accuracy.High,
  navigation: Location.Accuracy.BestForNavigation,
} as const;

let listener: ((location: RawLocation) => void) | null = null;

// Must run when this module loads: the system can wake the app to deliver updates.
TaskManager.defineTask<{ locations: RawLocation[] }>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  for (const location of data.locations) listener?.(location);
});

const toPermission = ({ granted, status }: Location.LocationPermissionResponse): BackgroundPermission => {
  if (granted) return 'granted';
  return status === 'denied' ? 'denied' : 'undetermined';
};

export const backgroundDriver: BackgroundDriver = {
  // Expo Go cannot run background tasks.
  async available() {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
    return await TaskManager.isAvailableAsync() && await Location.isBackgroundLocationAvailableAsync();
  },

  getPermission: async () => toPermission(await Location.getBackgroundPermissionsAsync()),
  requestPermission: async () => toPermission(await Location.requestBackgroundPermissionsAsync()),

  async start({ accuracy, timeInterval, distanceInterval }: SamplingProfile, onLocation) {
    listener = onLocation;
    const { ready, settings } = settingsService.store.getState();
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: accuracies[accuracy],
      timeInterval,
      distanceInterval,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: i18n.t('location.background.serviceTitle'),
        notificationBody: i18n.t(ready && settings.crashDetection
          ? 'location.background.serviceBody' : 'location.background.serviceBodyDetectionOff'),
        notificationColor: Colors.accent,
      },
    });
  },

  async stop() {
    listener = null;
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  },
};
