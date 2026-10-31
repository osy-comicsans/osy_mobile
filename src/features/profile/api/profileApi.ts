import type { AxiosInstance } from 'axios';
import { z } from 'zod';

import { parseResponse, sendRequest } from '@/common/lib/api/apiError';
import { settingsSchema, type AppSettings } from '@/features/settings/types/settings.types';

import {
  emergencyContactsSchema, profileSchema, profileUpdateSchema, pushTokenRequestSchema,
  drivingStatsSchema, reportHistorySchema, tripSchema,
  type EmergencyContact, type ProfileUpdate, type PushTokenRequest, type TripUpload,
} from '../types/profile.schemas';

export function createProfileApi(client: AxiosInstance, getOwner?: () => string | null) {
  const owned = () => { const userId = getOwner?.(); return { headers: userId ? { 'X-OSY-Owner': userId } : {} }; };
  return {
    getProfile: () => parseResponse(client.get('/me', owned()), profileSchema),
    getDrivingStats: () => parseResponse(client.get('/me/driving-stats', owned()), drivingStatsSchema),
    getReports: () => parseResponse(client.get('/me/reports', owned()), reportHistorySchema),
    // Bound to the account that drove it, which may not be the one signed in now.
    recordTrip: (trip: TripUpload, owner: string) => sendRequest(client.post('/me/trips', tripSchema.parse(trip), { headers: { 'X-OSY-Owner': owner } })),
    updatePreferences: (settings: AppSettings) => sendRequest(client.put('/me/preferences', settingsSchema.parse(settings), owned())),
    deleteAccount: () => sendRequest(client.delete('/me', owned())),
    deleteData: () => sendRequest(client.delete('/me/data', owned())),
    uploadPhoto: (uri: string, fileName: string) => {
      const form = new FormData(); form.append('photo', { uri, name: fileName.split('/').pop() ?? 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
      return parseResponse(client.put('/me/photo', form, { headers: { ...owned().headers, 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }), z.object({ photoUrl: z.url() }));
    },
    updateProfile: (update: ProfileUpdate) => parseResponse(
      client.put('/me', profileUpdateSchema.parse(update), owned()), profileSchema,
    ),
    getEmergencyContacts: () => parseResponse(client.get('/me/emergency-contacts', owned()), emergencyContactsSchema),
    replaceEmergencyContacts: (contacts: EmergencyContact[]) => parseResponse(
      client.put('/me/emergency-contacts', emergencyContactsSchema.parse({ contacts }), owned()),
      emergencyContactsSchema,
    ),
    registerPushToken: (request: PushTokenRequest) => sendRequest(
      client.post('/me/push-tokens', pushTokenRequestSchema.parse(request), owned()),
    ),
  };
}
