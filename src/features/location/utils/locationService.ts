import { createStore } from 'zustand/vanilla';

import type {
  DrivingState,
  BackgroundPermission,
  LocationDriver,
  LocationError,
  LocationState,
  MotionPermission,
  Removable,
  RawLocation,
  SamplingProfile,
} from '../types/location.types';
import {
  backgroundProfiles,
  initialDrivingTracker,
  nextDrivingTracker,
  samplingProfiles,
  toLocationFix,
} from './location.utils';

const WATCH_ERROR = 'watch';
const PERMISSION_ERROR = 'permission';

const initialState: LocationState = {
  status: 'idle',
  location: 'undetermined',
  canAskAgain: true,
  motion: 'undetermined',
  requesting: false,
  background: 'undetermined',
  fix: null,
  drivingState: 'stationary',
  error: null,
};

// Pure lifecycle code is kept outside React so permission races, profile swaps,
// and late subscriptions can be tested without a device.
export function createLocationService(driver: LocationDriver) {
  const store = createStore<LocationState>(() => initialState);
  let tracker = initialDrivingTracker;
  let session = 0;
  let started = false;
  let subscription: Removable | null = null;
  let activeProfile: DrivingState | null = null;
  let swappingSession: number | null = null;
  let inBackground = false;
  let backgroundProfile: SamplingProfile | null = null;
  let backgroundBusy = false;

  const removeWatch = () => {
    subscription?.remove();
    subscription = null;
    activeProfile = null;
  };

  const fail = (id: number, error: LocationError) => {
    if (id !== session) return;
    session++;
    removeWatch();
    store.setState({ status: 'error', error });
  };

  const backgroundPermission = async (): Promise<BackgroundPermission> => {
    const { background } = driver;
    if (!background || !(await background.available().catch(() => false))) return 'unavailable';
    return background.getPermission().catch((): BackgroundPermission => 'unavailable');
  };

  const motionPermission = (read: () => Promise<MotionPermission>) =>
    read().catch((): MotionPermission => 'unavailable');

  const receive = (id: number, location: RawLocation) => {
    if (id !== session) return;
    const { fix: previous } = store.getState();
    // Two watches overlap briefly during a profile swap and can repeat a fix.
    if (previous && location.timestamp <= previous.timestamp) return;
    const fix = toLocationFix(location, previous);
    tracker = nextDrivingTracker(tracker, fix.speedKmh, fix.timestamp);
    store.setState({ fix, drivingState: tracker.state });
    if (!inBackground) void applyProfile(id);
    void syncBackground();
  };

  // The new watch starts before the old one stops, so a swap never leaves a gap.
  const applyProfile = async (id: number) => {
    if (swappingSession === id) return;
    swappingSession = id;
    try {
      while (id === session && activeProfile !== tracker.state) {
        const target = tracker.state;
        const next = await driver.watch(
          samplingProfiles[target],
          (location) => receive(id, location),
          () => fail(id, WATCH_ERROR),
        );
        if (id !== session) {
          next.remove();
          return;
        }
        subscription?.remove();
        subscription = next;
        activeProfile = target;
      }
    } catch {
      fail(id, WATCH_ERROR);
    } finally {
      if (swappingSession === id) swappingSession = null;
    }
  };

  // Android only lets a foreground service start while the app is visible, so it
  // begins when driving starts, and runs alongside the watch until the drive ends.
  const syncBackground = async (): Promise<void> => {
    const { background } = driver;
    if (!background || backgroundBusy) return;
    backgroundBusy = true;
    try {
      for (;;) {
        const wanted = store.getState().background === 'granted' && (inBackground || tracker.state === 'driving');
        const target = wanted ? backgroundProfiles[tracker.state] : null;
        if (target === backgroundProfile) return;
        if (target) {
          const id = session;
          await background.start(target, (location) => receive(id, location));
        } else {
          await background.stop();
        }
        backgroundProfile = target;
      }
    } finally {
      backgroundBusy = false;
    }
  };

  const start = async (): Promise<void> => {
    started = true;
    const id = ++session;
    removeWatch();
    store.setState({ status: 'checking', error: null });
    try {
      const [servicesEnabled, permission, motion, background] = await Promise.all([
        driver.servicesEnabled(),
        driver.getPermission(),
        motionPermission(driver.getMotionPermission),
        backgroundPermission(),
      ]);
      if (id !== session) return;
      store.setState({ location: permission.location, canAskAgain: permission.canAskAgain, motion, background });
      if (permission.location === 'undetermined' || permission.location === 'denied') {
        store.setState({ status: 'permissionRequired' });
      } else if (!servicesEnabled) {
        store.setState({ status: 'servicesDisabled' });
      } else {
        await applyProfile(id);
        if (id === session) store.setState({ status: 'watching' });
      }
    } catch {
      fail(id, PERMISSION_ERROR);
    }
  };

  const stop = () => {
    started = false;
    inBackground = false;
    session++;
    removeWatch();
    store.setState({ status: 'idle' });
    void syncBackground().catch(() => undefined);
  };

  // Keeps watching through the background task when "Always" access allows it.
  const enterBackground = async (): Promise<void> => {
    const { status, background, requesting } = store.getState();
    // The iOS permission dialog makes the app inactive too.
    if (requesting) {
      stop();
      return;
    }
    if (status !== 'watching' || background !== 'granted') {
      stop();
      return;
    }
    inBackground = true;
    session++;
    removeWatch();
    try {
      backgroundProfile = null;
      await syncBackground();
    } catch {
      stop();
    }
  };

  const enterForeground = async (): Promise<void> => {
    inBackground = false;
    await start();
    await syncBackground().catch(() => undefined);
  };

  // The iOS permission dialog makes the app inactive, which stops the service.
  // It restarts from the foreground event if that arrives after this resolves.
  const requestPermission = async (): Promise<void> => {
    if (store.getState().requesting) return;
    store.setState({ requesting: true, error: null });
    try {
      const permission = await driver.requestPermission();
      store.setState({ location: permission.location, canAskAgain: permission.canAskAgain });
      if (permission.location === 'granted' || permission.location === 'limited') {
        store.setState({ motion: await motionPermission(driver.requestMotionPermission) });
      }
    } catch {
      store.setState({ error: PERMISSION_ERROR });
      return;
    } finally {
      store.setState({ requesting: false });
    }
    if (started) await start();
  };

  const requestBackgroundPermission = async (): Promise<void> => {
    if (!driver.background || store.getState().requesting) return;
    store.setState({ requesting: true, error: null });
    try {
      store.setState({ background: await driver.background.requestPermission() });
    } catch {
      store.setState({ error: PERMISSION_ERROR });
    } finally {
      store.setState({ requesting: false });
    }
  };

  return { store, start, stop, requestPermission, requestBackgroundPermission, enterBackground, enterForeground };
}

export type LocationService = ReturnType<typeof createLocationService>;
