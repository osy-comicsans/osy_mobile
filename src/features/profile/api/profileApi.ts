import type { AxiosInstance } from 'axios';

import { parseResponse, sendRequest } from '@/common/lib/api/apiError';

import {
  emergencyContactsSchema, profileSchema, profileUpdateSchema, pushTokenRequestSchema,
  type EmergencyContact, type ProfileUpdate, type PushTokenRequest,
} from '../types/profile.schemas';

export function createProfileApi(client: AxiosInstance) {
  return {
    getProfile: () => parseResponse(client.get('/me'), profileSchema),
    updateProfile: (update: ProfileUpdate) => parseResponse(
      client.put('/me', profileUpdateSchema.parse(update)), profileSchema,
    ),
    getEmergencyContacts: () => parseResponse(client.get('/me/emergency-contacts'), emergencyContactsSchema),
    replaceEmergencyContacts: (contacts: EmergencyContact[]) => parseResponse(
      client.put('/me/emergency-contacts', emergencyContactsSchema.parse({ contacts })),
      emergencyContactsSchema,
    ),
    registerPushToken: (request: PushTokenRequest) => sendRequest(
      client.post('/me/push-tokens', pushTokenRequestSchema.parse(request)),
    ),
  };
}
