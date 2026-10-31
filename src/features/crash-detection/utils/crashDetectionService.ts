import { createStore, type StoreApi } from 'zustand/vanilla';

import type { LocationFix, LocationState, Removable } from '@/features/location/types/location.types';

import type {
  CrashDetectionState, CrashEvent, CrashSensorDriver, CrashTrace, ModelCheckResult, MotionSample, NearMissEvent,
} from '../types/crash.types';
import { extractFeatures } from '../model/crashFeatures';
import { createCrashModelMonitor, type CrashClassifier } from '../model/crashModelMonitor';
import { buildModelWindow, IMPACT_OFFSET_SECONDS, type SpeedSample } from '../model/modelWindow';
import { createCrashDetector, replayTrace } from './crash.utils';

const SAME_CRASH_MS = 60_000;
const CHECK_WINDOW_MS = 16_500;

// Sensors run only while driving: the detector needs a driving speed before an
// impact anyway, and a 50 Hz stream is too costly to leave on.
export function createCrashDetectionService(
  driver: CrashSensorDriver,
  location: StoreApi<LocationState>,
  now: () => number = Date.now,
  classify?: CrashClassifier,
) {
  const store = createStore<CrashDetectionState>(() => ({ status: 'idle', lastCrash: null, lastNearMiss: null }));
  const listeners = new Set<(event: CrashEvent) => void>();
  const nearMissListeners = new Set<(event: NearMissEvent) => void>();
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

  // The model runs beside the rules, so it can add a detection but never hide one.
  const model = classify ? createCrashModelMonitor({
    classify,
    onCrash(event) {
      const last = store.getState().lastCrash;
      if (last && event.detectedAt - last.detectedAt < SAME_CRASH_MS) return;
      emit(event);
    },
    onNearMiss(at, probability) {
      const last = store.getState().lastCrash;
      if (last && at - last.detectedAt < SAME_CRASH_MS) return;
      const event = { at, probability };
      store.setState({ lastNearMiss: event });
      nearMissListeners.forEach((listener) => listener(event));
    },
  }) : null;

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
        model?.addAcceleration(sample);
      }, (sample) => {
        detector.addRotation(sample);
        model?.addRotation(sample);
      });
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
    model?.reset();
    store.setState({ status: 'idle' });
  };

  const sync = (state: LocationState) => {
    if (state.fix && state.fix !== lastFix) {
      lastFix = state.fix;
      // Android fixes can carry GNSS time, which may differ from the phone clock
      // that sensor samples are anchored to. Arrival time keeps a single clock.
      const fix = { ...state.fix, timestamp: now() };
      detector.addFix(fix);
      model?.addFix(fix);
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

  const onNearMiss = (listener: (event: NearMissEvent) => void) => {
    nearMissListeners.add(listener);
    return () => {
      nearMissListeners.delete(listener);
    };
  };

  // Development check: real sensors, real model, and no driving needed. It keeps its
  // own samples, so it cannot disturb detection or raise an alert.
  const checkModel = async (): Promise<ModelCheckResult> => {
    const acceleration: MotionSample[] = [];
    const rotation: MotionSample[] = [];
    const speeds: SpeedSample[] = [];
    const start = now();
    const stats = () => {
      const seconds = Math.max(1, (now() - start) / 1000);
      return {
        accelerationHz: acceleration.length / seconds,
        rotationHz: rotation.length / seconds,
        peakG: acceleration.reduce((peak, { x, y, z }) => Math.max(peak, Math.hypot(x, y, z)), 0),
      };
    };

    if (!classify || !(await driver.available().catch(() => false))) return { status: 'noSensors', ...stats() };

    let subscription: Removable;
    try {
      subscription = await driver.subscribe((sample) => acceleration.push(sample), (sample) => rotation.push(sample));
    } catch (error) {
      return { status: 'failed', reason: String(error), ...stats() };
    }

    const speedTimer = setInterval(() => {
      speeds.push({ t: now(), kmh: location.getState().fix?.speedKmh ?? 0 });
    }, 1000);
    await new Promise((resolve) => { setTimeout(resolve, CHECK_WINDOW_MS); });
    clearInterval(speedTimer);
    subscription.remove();
    if (acceleration.length === 0) return { status: 'noSensors', ...stats() };

    try {
      const impactAt = acceleration[acceleration.length - 1].t - IMPACT_OFFSET_SECONDS * 1000;
      const probabilities = await classify(extractFeatures(buildModelWindow(acceleration, rotation, speeds, impactAt)));
      return probabilities ? { status: 'done', probabilities, ...stats() } : { status: 'noRuntime', ...stats() };
    } catch (error) {
      return { status: 'failed', reason: String(error), ...stats() };
    }
  };

  // Plays a recorded or synthetic trace to the listeners, so the check-in flow
  // can be exercised without a real crash.
  const simulate = (trace: CrashTrace) => replayTrace(trace).forEach(emit);

  return { store, start, stop, onCrashDetected, onNearMiss, simulate, checkModel };
}

export type CrashDetectionService = ReturnType<typeof createCrashDetectionService>;
