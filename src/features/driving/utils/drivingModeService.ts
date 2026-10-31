import { createStore } from 'zustand/vanilla';

export interface DrivingModeState {
  ready: boolean;
  paused: boolean;
  saving: boolean;
  error: boolean;
}

interface PreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const KEY = 'osy.driving.paused';

export function createDrivingModeService(storage: PreferenceStorage) {
  // Wait for the saved preference before arming monitoring. Location and
  // emergency workflows do not wait for this service.
  const store = createStore<DrivingModeState>(() => ({ ready: false, paused: true, saving: false, error: false }));
  let generation = 0;
  let active = false;
  let restoring: Promise<string | null> | undefined;
  let pendingChange: Promise<string> | undefined;

  const start = async () => {
    active = true;
    const id = ++generation;
    try {
      const saved = await (pendingChange ?? (restoring ??= storage.getItem(KEY)));
      if (saved !== null && saved !== '0' && saved !== '1') throw new Error('Invalid monitoring preference.');
      if (active && id === generation) store.setState({ ready: true, paused: saved === '1', saving: false, error: false });
    } catch {
      restoring = undefined;
      if (active && id === generation) store.setState({ ready: true, paused: true, saving: false, error: true });
    }
  };

  return {
    store,
    start,
    stop() { active = false; generation++; },
    async setPaused(paused: boolean) {
      const current = store.getState();
      if (!active || !current.ready || current.saving) return;
      // Pause immediately; resume only after persistence succeeds.
      store.setState({ saving: true, paused: paused || current.paused, error: false });
      const id = generation;
      const saved = paused ? '1' : '0';
      const change = Promise.resolve().then(() => storage.setItem(KEY, saved)).then(() => saved);
      pendingChange = change;
      try {
        await change;
        restoring = Promise.resolve(saved);
        if (active && id === generation) store.setState({ paused, saving: false, error: false });
      } catch {
        restoring = undefined;
        if (active && id === generation) store.setState({ paused: true, saving: false, error: true });
      } finally {
        if (pendingChange === change) pendingChange = undefined;
      }
    },
  };
}

export type DrivingModeService = ReturnType<typeof createDrivingModeService>;

export function monitoringEnabled(state: DrivingModeState) {
  return state.ready && !state.paused;
}
