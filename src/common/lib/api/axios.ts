import { create, type AxiosInstance } from 'axios';
import { Platform } from 'react-native';

import { config } from '@/common/lib/config';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { languageStorage } from '@/common/lib/i18n/languageStorage';
import { secureStorage } from '@/common/lib/storage/secureStorage';

import { parseResponse } from './apiError';
import { installAuthInterceptors } from './authInterceptors';
import { authTokensSchema, createAuthSession } from './authSession';
import { createMockBackend } from './mock/mockBackend';

const mockAdapter = config.useMockApi ? createMockBackend(languageStorage) : undefined;

function createClient(): AxiosInstance {
  const client = create({
    baseURL: config.apiUrl,
    timeout: 15_000,
    headers: { Accept: 'application/json' },
    ...(mockAdapter ? { adapter: mockAdapter } : {}),
  });

  // Allow startup without a backend, but prevent accidental requests to the
  // web app's own origin when the backend URL has not been configured.
  client.interceptors.request.use((request) => {
    const standaloneWeather = config.weatherApiUrl && request.url === `${config.weatherApiUrl}/weather`;
    if (!config.apiUrl && !config.useMockApi && !standaloneWeather) {
      throw new Error('Set EXPO_PUBLIC_API_URL in .env.local before making API requests.');
    }

    request.headers.set('Accept-Language', getLanguage());
    return request;
  });

  return client;
}

// Web has no secure storage, so only the mock can sign in there, for previews.
const mockWebTokens = {
  getItem: async (key: string) => languageStorage.getItem(key),
  setItem: async (key: string, value: string) => { languageStorage.setItem(key, value); },
  removeItem: async (key: string) => { languageStorage.removeItem(key); },
};

export const authSession = createAuthSession(
  config.useMockApi && Platform.OS === 'web' ? mockWebTokens : secureStorage,
);

// For sign up, sign in, and token refresh, which send no access token.
export const publicApi = createClient();

export const api = createClient();

installAuthInterceptors(api, authSession, (refreshToken) => (
  parseResponse(publicApi.post('/auth/refresh', { refreshToken }), authTokensSchema)
));
