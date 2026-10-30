export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() ?? '',
  syncEnabled: process.env.EXPO_PUBLIC_SYNC_ENABLED === 'true',
} as const;
