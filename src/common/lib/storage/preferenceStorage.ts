import Storage from 'expo-sqlite/kv-store';

// Non-secret app preferences, separate from auth tokens and feature entities.
export const preferenceStorage = {
  getItem: (key: string) => Storage.getItem(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
};
