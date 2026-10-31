import { api } from '@/common/lib/api/axios';
import { preferenceStorage } from '@/common/lib/storage/preferenceStorage';

import { createSafetyApi } from './api/safetyApi';
import { createNearbyIncidents, type NearbyPreferences } from './utils/nearbyIncidents';

const safetyApi = createSafetyApi(api);

// Settings (#20) will own these, with the same defaults.
const preferences = (): NearbyPreferences => ({ enabled: true, radiusKm: 5 });

export const nearbyIncidents = createNearbyIncidents({
  fetchNearby: safetyApi.getNearbyIncidents,
  preferences,
  storage: preferenceStorage,
});
