import type {
  DrivingState,
  LocationFix,
  LocationPermission,
  RawLocation,
  SamplingProfile,
} from '../types/location.types';

const EARTH_RADIUS_M = 6_371_000;
// Parked phones report small drifting speeds, which should read as 0.
const MIN_MOVING_SPEED_MS = 0.3;
const MAX_DERIVED_ACCURACY_M = 30;
const MIN_DERIVED_GAP_MS = 1_000;
const MAX_DERIVED_GAP_MS = 30_000;

const WALKING_KMH = 2;
const DRIVING_ENTER_KMH = 20;
const DRIVING_HOLD_KMH = 8;
const DRIVING_ENTER_SAMPLES = 3;
const WALKING_EXIT_MS = 20_000;
// Long enough that a red light or queue does not end the drive.
const DRIVING_EXIT_MS = 120_000;

// iOS ignores timeInterval, so only a distance filter reduces its updates. It is
// used only while stationary: a filtered watch stops delivering once movement
// stops, so a moving state needs samples to notice the speed falling.
export const samplingProfiles: Record<DrivingState, SamplingProfile> = {
  stationary: { accuracy: 'high', timeInterval: 5_000, distanceInterval: 10 },
  walking: { accuracy: 'high', timeInterval: 2_000, distanceInterval: 0 },
  driving: { accuracy: 'navigation', timeInterval: 1_000, distanceInterval: 0 },
};

export interface DrivingTracker {
  state: DrivingState;
  fastSamples: number;
  slowSince: number | null;
}

export const initialDrivingTracker: DrivingTracker = {
  state: 'stationary',
  fastSamples: 0,
  slowSince: null,
};

export const msToKmh = (speedMs: number) => speedMs * 3.6;

export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

const validReading = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Used when the platform gives no speed. GPS jitter must not look like movement,
// so both fixes need to be accurate and the distance must exceed their error.
function deriveSpeed(previous: LocationFix | null, location: RawLocation): number | null {
  if (!previous) return null;
  const { accuracy } = location.coords;
  if (!validReading(accuracy) || !validReading(previous.accuracy)) return null;
  if (Math.max(accuracy, previous.accuracy) > MAX_DERIVED_ACCURACY_M) return null;
  const gap = location.timestamp - previous.timestamp;
  if (gap < MIN_DERIVED_GAP_MS || gap > MAX_DERIVED_GAP_MS) return null;
  const distance = distanceMeters(previous, location.coords);
  if (distance <= Math.max(accuracy, previous.accuracy)) return null;
  return distance / (gap / 1_000);
}

export function toLocationFix(location: RawLocation, previous: LocationFix | null): LocationFix {
  const { latitude, longitude, accuracy, heading, speed } = location.coords;
  // Platforms report unknown speed and heading as -1 as well as null.
  const measured = validReading(speed) ? speed : deriveSpeed(previous, location);
  const speedMs = measured === null ? null : measured < MIN_MOVING_SPEED_MS ? 0 : measured;
  return {
    latitude,
    longitude,
    accuracy: validReading(accuracy) ? accuracy : null,
    heading: validReading(heading) ? heading : null,
    speedMs,
    speedKmh: speedMs === null ? null : msToKmh(speedMs),
    timestamp: location.timestamp,
  };
}

export function nextDrivingTracker(
  tracker: DrivingTracker,
  speedKmh: number | null,
  at: number,
): DrivingTracker {
  if (speedKmh === null) return tracker;

  const fastSamples = speedKmh >= DRIVING_ENTER_KMH ? tracker.fastSamples + 1 : 0;
  if (fastSamples >= DRIVING_ENTER_SAMPLES) return { state: 'driving', fastSamples, slowSince: null };

  if (tracker.state === 'driving') {
    if (speedKmh >= DRIVING_HOLD_KMH) return { state: 'driving', fastSamples, slowSince: null };
    const slowSince = tracker.slowSince ?? at;
    if (at - slowSince < DRIVING_EXIT_MS) return { state: 'driving', fastSamples, slowSince };
    return { state: speedKmh >= WALKING_KMH ? 'walking' : 'stationary', fastSamples, slowSince: null };
  }

  if (speedKmh >= WALKING_KMH) return { state: 'walking', fastSamples, slowSince: null };
  if (tracker.state === 'stationary') return { state: 'stationary', fastSamples, slowSince: null };
  const slowSince = tracker.slowSince ?? at;
  if (at - slowSince < WALKING_EXIT_MS) return { state: 'walking', fastSamples, slowSince };
  return { state: 'stationary', fastSamples, slowSince: null };
}

export function toLocationPermission(response: {
  granted: boolean;
  status: string;
  ios?: { accuracy?: string };
  android?: { accuracy?: string };
}): LocationPermission {
  if (response.granted) {
    const approximate = response.ios?.accuracy === 'reduced' || response.android?.accuracy === 'coarse';
    return approximate ? 'limited' : 'granted';
  }
  return response.status === 'denied' ? 'denied' : 'undetermined';
}
