import { api } from '@/common/lib/api/axios';
import { preferenceStorage } from '@/common/lib/storage/preferenceStorage';
import { settingsService } from '@/features/settings/settingsService';

import { createSafetyApi } from './api/safetyApi';
import { createNearbyIncidents, type NearbyPreferences } from './utils/nearbyIncidents';

const safetyApi = createSafetyApi(api);

const preferences = (): NearbyPreferences => {
  const { settings } = settingsService.store.getState();
  return { enabled: settings.notifications.accident_nearby, radiusKm: settings.nearbyRadiusKm };
};

export const nearbyIncidents = createNearbyIncidents({
  fetchNearby: safetyApi.getNearbyIncidents,
  preferences,
  storage: preferenceStorage,
});
