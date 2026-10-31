import { createStore, type StoreApi } from 'zustand/vanilla';

import { distanceMeters } from '@/features/location/utils/location.utils';
import type { LocationFix, LocationState } from '@/features/location/types/location.types';

import type { OsrmApi } from '../api/osrmApi';
import type { CurrentRoad, RoadState, TracePoint } from '../types/osrm.schemas';
import { isSameRoad, roadFromMatch, roadFromNearest } from './road.utils';

const MAX_TRACE_POINTS = 8;
const MIN_POINT_SPACING_METERS = 15;
const MIN_TRACE_POINTS = 3;
const MIN_REQUEST_GAP_MS = 3_000;
const MIN_REQUEST_DISTANCE_METERS = 50;
const FORCED_REQUEST_GAP_MS = 15_000;
// Two matches in a row, so a road running alongside does not cause flicker.
const CONFIRMATIONS_TO_CHANGE = 2;

export function createRoadService(
  api: Pick<OsrmApi, 'match' | 'nearest'>,
  location: StoreApi<LocationState>,
  now: () => number = Date.now,
) {
  const store = createStore<RoadState>(() => ({ road: null, stale: false }));
  let unsubscribe: (() => void) | null = null;
  let trace: TracePoint[] = [];
  let lastFix: LocationFix | null = null;
  let inFlight = false;
  let lastRequestAt = 0;
  let lastRequestPoint: TracePoint | null = null;
  let candidate: CurrentRoad | null = null;
  let confirmations = 0;
  let session = 0;

  const markStale = () => {
    if (store.getState().road) store.setState({ stale: true });
  };

  const accept = (road: CurrentRoad) => {
    const current = store.getState().road;
    if (!current || isSameRoad(current, road)) {
      candidate = null;
      confirmations = 0;
      store.setState({ road, stale: false });
      return;
    }

    confirmations = candidate && isSameRoad(candidate, road) ? confirmations + 1 : 1;
    candidate = road;
    if (confirmations >= CONFIRMATIONS_TO_CHANGE) {
      candidate = null;
      confirmations = 0;
      store.setState({ road, stale: false });
    } else {
      store.setState({ stale: false });
    }
  };

  const request = async () => {
    const id = session;
    const latest = trace[trace.length - 1];
    inFlight = true;
    lastRequestAt = now();
    lastRequestPoint = latest;
    try {
      const road = trace.length >= MIN_TRACE_POINTS
        ? roadFromMatch(await api.match([...trace]), now())
        : roadFromNearest(await api.nearest(latest), now());
      if (id !== session) return;
      if (road) accept(road);
      else markStale();
    } catch {
      if (id === session) markStale();
    } finally {
      if (id === session) inFlight = false;
    }
  };

  const isDue = (point: TracePoint) => {
    if (inFlight) return false;
    const elapsed = now() - lastRequestAt;
    if (elapsed < MIN_REQUEST_GAP_MS) return false;
    const moved = lastRequestPoint ? distanceMeters(lastRequestPoint, point) : Infinity;
    return moved >= MIN_REQUEST_DISTANCE_METERS || elapsed >= FORCED_REQUEST_GAP_MS;
  };

  const addFix = ({ latitude, longitude, accuracy, timestamp }: LocationFix) => {
    const point = { latitude, longitude, accuracy, timestamp };
    const previous = trace[trace.length - 1];
    // OSRM rejects timestamps that do not increase.
    if (previous && point.timestamp - previous.timestamp < 1000) return;
    if (previous && distanceMeters(previous, point) < MIN_POINT_SPACING_METERS) return;

    trace = [...trace, point].slice(-MAX_TRACE_POINTS);
    if (isDue(point)) void request();
  };

  const reset = () => {
    session += 1;
    trace = [];
    inFlight = false;
    candidate = null;
    confirmations = 0;
    lastRequestPoint = null;
  };

  const sync = (state: LocationState) => {
    const driving = state.status === 'watching' && state.drivingState === 'driving';
    if (!driving) {
      if (trace.length > 0) reset();
      markStale();
      lastFix = state.fix;
      return;
    }
    if (state.fix && state.fix !== lastFix) {
      lastFix = state.fix;
      addFix(state.fix);
    }
  };

  return {
    store,

    start() {
      if (unsubscribe) return;
      unsubscribe = location.subscribe(sync);
      sync(location.getState());
    },

    stop() {
      unsubscribe?.();
      unsubscribe = null;
      reset();
      markStale();
    },
  };
}

export type RoadService = ReturnType<typeof createRoadService>;
