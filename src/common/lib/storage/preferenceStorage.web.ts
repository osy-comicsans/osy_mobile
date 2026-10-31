export const preferenceStorage = {
  async getItem(key: string) {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof window === 'undefined') throw new Error('Preferences are unavailable.');
    window.localStorage.setItem(key, value);
  },
};
