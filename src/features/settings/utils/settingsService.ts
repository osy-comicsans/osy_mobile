import { createStore } from 'zustand/vanilla';
import { defaultSettings, settingsSchema, type SettingsPatch } from '../types/settings.types';
export interface SettingsState {
  settings: typeof defaultSettings; ready: boolean; saving: boolean; error: boolean;
  consentOwner: string | null; accountSync: 'waiting' | 'synced' | 'failed';
}

export function createSettingsService(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }) {
  const store = createStore<SettingsState>(() => ({ settings: defaultSettings, ready: false, saving: false, error: false, consentOwner: null, accountSync: 'waiting' }));
  let restore: Promise<void> | undefined;
  let tail = Promise.resolve();
  const start = () => restore ??= (async () => {
    try {
      const saved = await storage.getItem('osy.settings.v1');
      const value = saved ? JSON.parse(saved) : null;
      // Laid over the defaults, so a setting added or renamed since this was saved
      // starts at its default instead of resetting every other one.
      const settings = value ? settingsSchema.parse({ ...defaultSettings, ...value,
        notifications: { ...defaultSettings.notifications, ...value.notifications } }) : defaultSettings;
      store.setState({ settings, ready: true,
        consentOwner: typeof value?.consentOwner === 'string' ? value.consentOwner : null });
    } catch { store.setState({ settings: { ...defaultSettings, crashDetection: false }, ready: true, error: true }); }
  })();
  return {
    store, start,
    setAccount(consentOwner: string | null) {
      const operation = tail.then(async () => {
        await start();
        if (store.getState().consentOwner === consentOwner) return;
        const settings = { ...store.getState().settings, dataSharing: false, shareMedicalInfo: false };
        store.setState({ settings, consentOwner, accountSync: 'waiting' });
        try { await storage.setItem('osy.settings.v1', JSON.stringify({ ...settings, consentOwner })); }
        catch { store.setState({ error: true }); }
      });
      tail = operation.catch(() => undefined); return operation;
    },
    update(patch: SettingsPatch) {
      const operation = tail.then(async () => {
        await start();
        const current = store.getState();
        const settings = settingsSchema.parse({ ...current.settings, ...patch,
          notifications: { ...current.settings.notifications, ...patch.notifications } });
        store.setState({ saving: true });
        try {
          await storage.setItem('osy.settings.v1', JSON.stringify({ ...settings, consentOwner: current.consentOwner }));
          store.setState({ settings, saving: false, error: false, accountSync: 'waiting' });
        } catch { store.setState({ saving: false, error: true }); throw new Error('Settings could not be saved.'); }
      });
      tail = operation.catch(() => undefined);
      return operation;
    },
  };
}
