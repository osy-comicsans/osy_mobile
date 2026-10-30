import Storage from 'expo-sqlite/kv-store';

// Read synchronously: the language picks fonts and layout direction before the first render.
export const languageStorage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
  removeItem: (key: string) => { Storage.removeItemSync(key); },
};
