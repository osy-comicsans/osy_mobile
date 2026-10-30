const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';

export const config = {
  apiUrl,
  // Development falls back to the mock backend. A release build only uses it
  // when asked to, so a missing URL can never approve real users' documents.
  useMockApi: !apiUrl && (__DEV__ || process.env.EXPO_PUBLIC_MOCK_API === 'true'),
  syncEnabled: process.env.EXPO_PUBLIC_SYNC_ENABLED === 'true',
} as const;
