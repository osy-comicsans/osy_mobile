import { create, type AxiosInstance } from 'axios';

import { config } from '@/common/lib/config';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { secureStorage } from '@/common/lib/storage/secureStorage';

import { parseResponse } from './apiError';
import { installAuthInterceptors } from './authInterceptors';
import { authTokensSchema, createAuthSession } from './authSession';

function createClient(): AxiosInstance {
  const client = create({
    baseURL: config.apiUrl,
    timeout: 15_000,
    headers: { Accept: 'application/json' },
  });

  // Allow startup without a backend, but prevent accidental requests to the
  // web app's own origin when the backend URL has not been configured.
  client.interceptors.request.use((request) => {
    if (!config.apiUrl) {
      throw new Error('Set EXPO_PUBLIC_API_URL in .env.local before making API requests.');
    }

    request.headers.set('Accept-Language', getLanguage());
    return request;
  });

  return client;
}

export const authSession = createAuthSession(secureStorage);

// For sign up, sign in, and token refresh, which send no access token.
export const publicApi = createClient();

export const api = createClient();

installAuthInterceptors(api, authSession, (refreshToken) => (
  parseResponse(publicApi.post('/auth/refresh', { refreshToken }), authTokensSchema)
));
