import type { LocationFix, Removable } from '@/features/location/types/location.types';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Acceleration in g with gravity included, rotation in rad/s. `t` is epoch
// milliseconds, the same clock as GPS fixes.
export interface MotionSample extends Vector3 {
  t: number;
}

export interface CrashSnapshot {
  impactAt: number;
  location: LocationFix | null;
  speedBeforeKmh: number;
  peakG: number;
  vehicleStopped: boolean;
  phoneStill: boolean;
  rotated: boolean;
}

export interface CrashEvent {
  detectedAt: number;
  confidence: number;
  snapshot: CrashSnapshot;
}

export interface CrashTrace {
  acceleration: MotionSample[];
  rotation: MotionSample[];
  fixes: LocationFix[];
}

export type CrashDetectionStatus = 'idle' | 'monitoring' | 'unavailable';

export interface CrashDetectionState {
  status: CrashDetectionStatus;
  lastCrash: CrashEvent | null;
}

export interface CrashSensorDriver {
  available(): Promise<boolean>;
  subscribe(
    onAcceleration: (sample: MotionSample) => void,
    onRotation: (sample: MotionSample) => void,
  ): Promise<Removable>;
}
