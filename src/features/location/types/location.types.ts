export type DrivingState = 'stationary' | 'walking' | 'driving';

export type LocationPermission = 'undetermined' | 'granted' | 'limited' | 'denied';
export type MotionPermission = 'undetermined' | 'granted' | 'denied' | 'unavailable';

export type LocationStatus =
  | 'idle'
  | 'checking'
  | 'watching'
  | 'permissionRequired'
  | 'servicesDisabled'
  | 'error';

export interface PermissionSummary {
  location: LocationPermission;
  canAskAgain: boolean;
}

export interface RawLocation {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
}

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speedMs: number | null;
  speedKmh: number | null;
  timestamp: number;
}

export interface LocationState {
  status: LocationStatus;
  location: LocationPermission;
  canAskAgain: boolean;
  motion: MotionPermission;
  requesting: boolean;
  fix: LocationFix | null;
  drivingState: DrivingState;
  error: string | null;
}

export interface SamplingProfile {
  accuracy: 'high' | 'navigation';
  timeInterval: number;
  distanceInterval: number;
}

export interface Removable {
  remove(): void;
}

export interface LocationDriver {
  servicesEnabled(): Promise<boolean>;
  getPermission(): Promise<PermissionSummary>;
  requestPermission(): Promise<PermissionSummary>;
  getMotionPermission(): Promise<MotionPermission>;
  requestMotionPermission(): Promise<MotionPermission>;
  watch(
    profile: SamplingProfile,
    onLocation: (location: RawLocation) => void,
    onError: (reason: string) => void,
  ): Promise<Removable>;
}
