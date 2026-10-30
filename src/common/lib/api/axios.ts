import { create } from 'axios';

import { config } from '@/common/lib/config';

export const api = create({
  baseURL: config.apiUrl,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

// Allow startup without a backend, but prevent accidental requests to the
// web app's own origin when the backend URL has not been configured.
api.interceptors.request.use((request) => {
  if (!config.apiUrl) {
    throw new Error('Set EXPO_PUBLIC_API_URL in .env.local before making API requests.');
  }

  return request;
});
