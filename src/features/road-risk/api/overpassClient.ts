import { create } from 'axios';

import { config } from '@/common/lib/config';

import { createOverpassApi } from './overpassApi';

// A separate client, so the user's access token can never reach this server.
export const overpassApi = createOverpassApi(create({
  baseURL: config.overpassUrl,
  timeout: 45_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    // The public server refuses clients that do not identify themselves.
    'User-Agent': 'OSY-mobile/1.0 (road safety app)',
  },
}));
