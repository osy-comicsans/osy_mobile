export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() ?? '',
} as const;
