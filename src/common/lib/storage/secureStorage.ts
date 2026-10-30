import * as SecureStore from 'expo-secure-store';

async function requireSecureStorage(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure storage is unavailable on this platform.');
  }
}

export const secureStorage = {
  isAvailable: SecureStore.isAvailableAsync,

  async getItem(key: string): Promise<string | null> {
    await requireSecureStorage();
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await requireSecureStorage();
    // Crash escalation may need the access token while the phone is locked.
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },

  async removeItem(key: string): Promise<void> {
    await requireSecureStorage();
    await SecureStore.deleteItemAsync(key);
  },
};
