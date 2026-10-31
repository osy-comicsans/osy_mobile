import type { StoreApi } from 'zustand/vanilla';
import { monitoringEnabled, type DrivingModeState } from './drivingModeService';

// Service lifetimes change synchronously with the shared preference. Providers
// remain mounted, preserving emergency contexts and notification listeners.
export function bindMonitoring(mode: StoreApi<DrivingModeState>, service: { start(): void; stop(): void }) {
  let enabled: boolean | undefined;
  const sync = (state: DrivingModeState) => {
    const next = monitoringEnabled(state);
    if (next === enabled) return;
    enabled = next;
    if (next) service.start(); else service.stop();
  };
  const unsubscribe = mode.subscribe(sync);
  sync(mode.getState());
  return () => { unsubscribe(); service.stop(); };
}
