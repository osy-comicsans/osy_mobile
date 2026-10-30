// Node's own `localStorage` is incomplete, so the static web export must skip it.
const storage = () => (typeof window === 'undefined' ? null : window.localStorage);

export const languageStorage = {
  getItem: (key: string) => storage()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => storage()?.setItem(key, value),
  removeItem: (key: string) => storage()?.removeItem(key),
};
