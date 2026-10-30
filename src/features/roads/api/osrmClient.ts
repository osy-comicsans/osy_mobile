import { create } from 'axios';

import { config } from '@/common/lib/config';

import { createOsrmApi } from './osrmApi';

// A separate client, so the user's access token can never reach the OSRM server.
export const osrmApi = createOsrmApi(create({
  baseURL: config.osrmUrl,
  timeout: 8_000,
  headers: { Accept: 'application/json' },
}));
