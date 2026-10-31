import type { StoreApi } from 'zustand/vanilla';
import type { SettingsState } from '../../../../features/settings/utils/settingsService';
import type { AppSettings } from '../../../../features/settings/types/settings.types';

export function createPreferencesSync(store: StoreApi<SettingsState>, userId: string,
  send: (settings: AppSettings) => Promise<void>, isCurrentOwner: () => boolean) {
  let active = false; let syncing = false; let lastSent: string | null = null;
  let unsubscribe: (() => void) | undefined; let timer: ReturnType<typeof setInterval> | undefined;
  const flush = async () => {
    if (!active || syncing) return; syncing = true;
    try {
      while (active && isCurrentOwner()) {
        const state = store.getState(); const payload = JSON.stringify(state.settings);
        if (!state.ready || state.consentOwner !== userId) return;
        if (payload === lastSent) {
          if (state.accountSync !== 'synced') store.setState({ accountSync: 'synced' });
          return;
        }
        await send(state.settings); lastSent = payload;
      }
    } catch { if (active && isCurrentOwner()) store.setState({ accountSync: 'failed' }); }
    finally { syncing = false; }
  };
  const stop = () => { active = false; unsubscribe?.(); clearInterval(timer); unsubscribe = undefined; };
  return { flush, stop, start() {
    if (active) return stop; active = true;
    unsubscribe = store.subscribe(() => { void flush(); });
    timer = setInterval(() => { void flush(); }, 30_000); void flush(); return stop;
  } };
}
