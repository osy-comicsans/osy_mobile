const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';

// The public demo server is the default. It is rate limited and has no uptime guarantee.
const osrmUrl = process.env.EXPO_PUBLIC_OSRM_URL?.trim() || 'https://router.project-osrm.org';

export const config = {
  apiUrl,
  osrmUrl,
  // Development falls back to the mock backend. A release build only uses it
  // when asked to, so a missing URL can never approve real users' documents.
  useMockApi: !apiUrl && (__DEV__ || process.env.EXPO_PUBLIC_MOCK_API === 'true'),
  syncEnabled: process.env.EXPO_PUBLIC_SYNC_ENABLED === 'true',
} as const;
