import { createStore, type StoreApi } from 'zustand/vanilla';

import type { LocationFix, LocationState, Removable } from '@/features/location/types/location.types';

import type { CrashDetectionState, CrashEvent, CrashSensorDriver, CrashTrace } from '../types/crash.types';
import { createCrashDetector, replayTrace } from './crash.utils';

// Sensors run only while driving: the detector needs a driving speed before an
// impact anyway, and a 50 Hz stream is too costly to leave on.
export function createCrashDetectionService(
  driver: CrashSensorDriver,
  location: StoreApi<LocationState>,
  now: () => number = Date.now,
) {
  const store = createStore<CrashDetectionState>(() => ({ status: 'idle', lastCrash: null }));
  const listeners = new Set<(event: CrashEvent) => void>();
  const detector = createCrashDetector();
  let session = 0;
  let sensors: Removable | null = null;
  let driving = false;
  let lastFix: LocationFix | null = null;
  let unsubscribe: (() => void) | null = null;

  const emit = (event: CrashEvent) => {
    store.setState({ lastCrash: event });
    listeners.forEach((listener) => listener(event));
  };

  const startSensors = async (id: number) => {
    try {
      const available = await driver.available();
      if (id !== session) return;
      if (!available) {
        store.setState({ status: 'unavailable' });
        return;
      }
      const subscription = await driver.subscribe((sample) => {
        const event = detector.addAcceleration(sample);
        if (event) emit(event);
      }, detector.addRotation);
      if (id !== session) {
        subscription.remove();
        return;
      }
      sensors = subscription;
      store.setState({ status: 'monitoring' });
    } catch {
      if (id === session) store.setState({ status: 'unavailable' });
    }
  };

  const stopSensors = () => {
    session++;
    sensors?.remove();
    sensors = null;
    detector.reset();
    store.setState({ status: 'idle' });
  };

  const sync = (state: LocationState) => {
    if (state.fix && state.fix !== lastFix) {
      lastFix = state.fix;
      // Android fixes can carry GNSS time, which may differ from the phone clock
      // that sensor samples are anchored to. Arrival time keeps a single clock.
      detector.addFix({ ...state.fix, timestamp: now() });
    }
    const nowDriving = state.status === 'watching' && state.drivingState === 'driving';
    if (nowDriving === driving) return;
    driving = nowDriving;
    if (driving) void startSensors(++session);
    else stopSensors();
  };

  const start = () => {
    if (unsubscribe) return;
    unsubscribe = location.subscribe(sync);
    sync(location.getState());
  };

  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    driving = false;
    lastFix = null;
    stopSensors();
  };

  const onCrashDetected = (listener: (event: CrashEvent) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  // Plays a recorded or synthetic trace to the listeners, so the check-in flow
  // can be exercised without a real crash.
  const simulate = (trace: CrashTrace) => replayTrace(trace).forEach(emit);

  return { store, start, stop, onCrashDetected, simulate };
}

export type CrashDetectionService = ReturnType<typeof createCrashDetectionService>;
