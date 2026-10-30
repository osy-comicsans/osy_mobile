import { createStore } from 'zustand/vanilla';

import type {
  DrivingState,
  LocationDriver,
  LocationState,
  MotionPermission,
  Removable,
  RawLocation,
} from '../types/location.types';
import {
  initialDrivingTracker,
  nextDrivingTracker,
  samplingProfiles,
  toLocationFix,
} from './location.utils';

const WATCH_ERROR = 'Could not read your location. Check location services and try again.';
const PERMISSION_ERROR = 'Could not check location access. Try again.';

const initialState: LocationState = {
  status: 'idle',
  location: 'undetermined',
  canAskAgain: true,
  motion: 'undetermined',
  requesting: false,
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

  const removeWatch = () => {
    subscription?.remove();
    subscription = null;
    activeProfile = null;
  };

  const fail = (id: number, error: string) => {
    if (id !== session) return;
    session++;
    removeWatch();
    store.setState({ status: 'error', error });
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
    void applyProfile(id);
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

  const start = async (): Promise<void> => {
    started = true;
    const id = ++session;
    removeWatch();
    store.setState({ status: 'checking', error: null });
    try {
      const [servicesEnabled, permission, motion] = await Promise.all([
        driver.servicesEnabled(),
        driver.getPermission(),
        motionPermission(driver.getMotionPermission),
      ]);
      if (id !== session) return;
      store.setState({ location: permission.location, canAskAgain: permission.canAskAgain, motion });
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
    session++;
    removeWatch();
    store.setState({ status: 'idle' });
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

  return { store, start, stop, requestPermission };
}

export type LocationService = ReturnType<typeof createLocationService>;
