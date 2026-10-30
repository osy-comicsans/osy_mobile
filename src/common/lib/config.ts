const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';

export const config = {
  apiUrl,
  // Optional URL for the standalone weather service. This is public routing
  // configuration; the Open-Meteo credential stays on that service.
  weatherApiUrl: process.env.EXPO_PUBLIC_WEATHER_API_URL?.trim().replace(/\/+$/, '') ?? '',
  // Development falls back to the mock backend. A release build only uses it
  // when asked to, so a missing URL can never approve real users' documents.
  useMockApi: !apiUrl && (__DEV__ || process.env.EXPO_PUBLIC_MOCK_API === 'true'),
  syncEnabled: process.env.EXPO_PUBLIC_SYNC_ENABLED === 'true',
} as const;
