import type { StoreApi } from 'zustand/vanilla';

import type { Trip } from '@/common/lib/database/repositories/tripRepository';
import type { LocationFix, LocationState } from '@/features/location/types/location.types';
import { distanceMeters, msToKmh } from '@/features/location/utils/location.utils';

// Fixes less accurate than this wander further than a car moves between them.
const MAX_FIX_ACCURACY_M = 50;
// Faster than any car on the road, so the fix jumped and is left out.
const MAX_SPEED_KMH = 250;
// Tracking stopped for this long, for example while the app was closed, so the trip ends at its last fix.
const MAX_FIX_GAP_MS = 5 * 60_000;
// Shorter drives are parking manoeuvres or GPS noise rather than trips.
const MIN_TRIP_DISTANCE_M = 500;
// Saving every fix would write to storage once a second while driving.
const SAVE_INTERVAL_MS = 30_000;

interface TripStore {
  saveOpen(trip: Trip): Promise<void>;
  finish(trip: Trip, keep: boolean): Promise<void>;
  finishAbandoned(keep: (trip: Trip) => boolean): Promise<void>;
}

interface TripRecorderOptions {
  location: StoreApi<LocationState>;
  trips: TripStore;
  // The account trips are recorded for, or null when none should be.
  owner: () => string | null;
  createId: () => string;
  // Called once a finished trip is waiting to upload.
  onFinished?: () => void;
}

const isRealTrip = (trip: Trip) => trip.distanceMeters >= MIN_TRIP_DISTANCE_M;

// A trip runs while the location service reports driving, from whichever fixes
// reach its store, including background ones.
export function createTripRecorder({ location, trips, owner, createId, onFinished }: TripRecorderOptions) {
  let unsubscribe: (() => void) | null = null;
  let trip: Trip | null = null;
  // The last fix counted towards the distance.
  let point: LocationFix | null = null;
  let lastFix: LocationFix | null = null;
  let savedAt = 0;
  let recovery: Promise<void> | undefined;

  // Another account, or nobody, must never inherit or upload this trip.
  const current = () => {
    if (trip && trip.owner !== owner()) { trip = null; point = null; }
    return trip;
  };

  const save = (open: Trip) => { void trips.saveOpen(open).catch(() => undefined); };

  const end = () => {
    const finished = current();
    if (!finished) return;
    trip = null; point = null;
    const keep = isRealTrip(finished);
    void trips.finish(finished, keep).then(() => { if (keep) onFinished?.(); }, () => undefined);
  };

  const add = (fix: LocationFix) => {
    if (!trip) return;
    trip = { ...trip, endedAt: fix.timestamp };
    if (fix.accuracy === null || fix.accuracy > MAX_FIX_ACCURACY_M) return;
    if (point) {
      const meters = distanceMeters(point, fix);
      const seconds = (fix.timestamp - point.timestamp) / 1000;
      if (seconds <= 0 || msToKmh(meters / seconds) > MAX_SPEED_KMH) return;
      // A stopped car's fixes still wander, which is not distance driven.
      if (fix.speedMs !== 0) trip = { ...trip, distanceMeters: trip.distanceMeters + meters };
    }
    point = fix;
  };

  const sync = ({ fix, drivingState }: LocationState) => {
    if (!fix || fix === lastFix) return;
    lastFix = fix;
    const open = current();
    if (open && fix.timestamp - open.endedAt > MAX_FIX_GAP_MS) end();
    if (drivingState !== 'driving') {
      add(fix);
      end();
      return;
    }
    const userId = owner();
    if (!userId) return;
    if (!trip) {
      trip = { id: createId(), owner: userId, startedAt: fix.timestamp, endedAt: fix.timestamp, distanceMeters: 0, warnings: 0 };
      savedAt = fix.timestamp;
    }
    add(fix);
    if (fix.timestamp - savedAt >= SAVE_INTERVAL_MS) {
      savedAt = fix.timestamp;
      save(trip);
    }
  };

  return {
    start() {
      if (unsubscribe) return;
      unsubscribe = location.subscribe(sync);
      sync(location.getState());
    },

    // Pausing monitoring ends the trip under way.
    stop() {
      unsubscribe?.();
      unsubscribe = null;
      lastFix = null;
      end();
    },

    countWarning() {
      const open = current();
      if (!open) return;
      trip = { ...open, warnings: open.warnings + 1 };
      save(trip);
    },

    // Once per launch, before any trip of this run is saved.
    recover() {
      recovery ??= trips.finishAbandoned(isRealTrip).then(() => onFinished?.());
      return recovery;
    },
  };
}
