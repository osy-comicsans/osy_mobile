import type { LocationFix } from '@/features/location/types/location.types';

import type { CrashTrace, MotionSample, Vector3 } from '../types/crash.types';

const SAMPLE_MS = 20;
const FIX_MS = 1_000;
const IMPACT_MS = 10_000;
const DROP_MS = 5_000;
const JOLT_MS = 8_000;

const upright: Vector3 = { x: 0, y: -1, z: 0 };
const faceUp: Vector3 = { x: 0, y: 0, z: -1 };
const faceDown: Vector3 = { x: 0, y: 0, z: 1 };
const freeFall: Vector3 = { x: 0.01, y: -0.01, z: 0.01 };
const zero: Vector3 = { x: 0, y: 0, z: 0 };

// Deterministic vibration, so a replayed trace gives the same result every run.
const shake = (base: Vector3, t: number, amount: number): Vector3 => ({
  x: base.x + amount * Math.sin(t / 37),
  y: base.y + amount * Math.cos(t / 53),
  z: base.z + amount * Math.sin(t / 71),
});

const fixAt = (timestamp: number, speedKmh: number): LocationFix => ({
  latitude: 36.75,
  longitude: 3.05,
  accuracy: 5,
  heading: 90,
  speedMs: speedKmh / 3.6,
  speedKmh,
  timestamp,
});

interface TraceSpec {
  duration: number;
  acceleration(t: number): Vector3;
  rotation(t: number): Vector3;
  // null leaves a gap, as when GPS has no fix.
  speedKmh(t: number): number | null;
}

function buildTrace(start: number, { duration, acceleration, rotation, speedKmh }: TraceSpec): CrashTrace {
  const times = (step: number) => Array.from({ length: duration / step }, (_, index) => index * step);
  const sample = (read: (t: number) => Vector3) => (t: number): MotionSample => ({ t: start + t, ...read(t) });
  return {
    acceleration: times(SAMPLE_MS).map(sample(acceleration)),
    rotation: times(SAMPLE_MS).map(sample(rotation)),
    fixes: times(FIX_MS).flatMap((t) => {
      const speed = speedKmh(t);
      return speed === null ? [] : [fixAt(start + t, speed)];
    }),
  };
}

interface CrashTraceOptions {
  start?: number;
  speedKmh?: number;
  peakG?: number;
  rollover?: boolean;
  // The vehicle leaves the ground for this long before the impact.
  airborneMs?: number;
  // Time GPS takes to report the vehicle at rest after the impact.
  slideMs?: number;
}

// A phone in a dashboard mount during a frontal collision 10 s into the trace.
export function crashTrace({
  start = 0,
  speedKmh = 50,
  peakG = 6,
  rollover = false,
  airborneMs = 0,
  slideMs = 1_500,
}: CrashTraceOptions = {}): CrashTrace {
  return buildTrace(start, {
    duration: 25_000,
    acceleration: (t) => {
      if (t < IMPACT_MS - airborneMs) return shake(upright, t, 0.04);
      if (t < IMPACT_MS) return freeFall;
      if (t < IMPACT_MS + 120) {
        const pulse = 1 - Math.abs(t - IMPACT_MS - 60) / 60;
        return { ...upright, z: -peakG * pulse };
      }
      if (t < IMPACT_MS + 800) return shake(upright, t, 0.6);
      return shake(rollover ? faceDown : upright, t, 0.005);
    },
    rotation: (t) => {
      if (t < IMPACT_MS) return shake(zero, t, 0.05);
      if (t < IMPACT_MS + 800) return rollover ? { x: 8, y: 0, z: 0 } : shake(zero, t, 1);
      return zero;
    },
    speedKmh: (t) => (t <= IMPACT_MS ? speedKmh : Math.max(0, speedKmh * (1 - (t - IMPACT_MS) / slideMs))),
  });
}

// A phone that falls about 45 cm and hits the floor 5.3 s into the trace. Given
// a speed, the car brakes to a stop around the drop, like a phone sliding off a seat.
export function droppedPhoneTrace({ start = 0, speedKmh = 0 } = {}): CrashTrace {
  return buildTrace(start, {
    duration: 20_000,
    acceleration: (t) => {
      if (t < DROP_MS) return shake(faceUp, t, 0.03);
      if (t < DROP_MS + 300) return freeFall;
      if (t < DROP_MS + 320) return { x: 0.5, y: 0.3, z: 9 };
      if (t < DROP_MS + 600) return shake(faceUp, t, 0.4);
      return faceDown;
    },
    rotation: (t) => (t >= DROP_MS && t < DROP_MS + 600 ? { x: 3, y: 2, z: 0 } : zero),
    speedKmh: (t) => {
      if (t < 4_000) return speedKmh;
      return t < 8_000 ? speedKmh * (1 - (t - 4_000) / 4_000) : 0;
    },
  });
}

// Emergency braking at 0.9 g from cruising speed to a stop, without an impact.
export function hardBrakingTrace({ start = 0, speedKmh = 80 } = {}): CrashTrace {
  const brakingMs = (speedKmh / 3.6 / (0.9 * 9.81)) * 1_000;
  const braking = (t: number) => t >= 5_000 && t < 5_000 + brakingMs;
  return buildTrace(start, {
    duration: 20_000,
    acceleration: (t) => shake({ ...upright, z: braking(t) ? -0.9 : 0 }, t, braking(t) ? 0.15 : 0.04),
    rotation: (t) => shake(zero, t, 0.05),
    speedKmh: (t) => (t < 5_000 ? speedKmh : Math.max(0, speedKmh * (1 - (t - 5_000) / brakingMs))),
  });
}

// A sharp jolt at speed that the car drives on from. Given stopMs, the driver
// then brakes normally to a stop over that time, as at a red light.
export function potholeTrace({ start = 0, speedKmh = 50, stopMs = 0 } = {}): CrashTrace {
  return buildTrace(start, {
    duration: 20_000,
    acceleration: (t) => (t >= JOLT_MS && t < JOLT_MS + 40 ? { x: 0.3, y: -5, z: 0.5 } : shake(upright, t, 0.04)),
    rotation: (t) => shake(zero, t, 0.05),
    speedKmh: (t) =>
      stopMs === 0 || t <= JOLT_MS ? speedKmh : Math.max(0, speedKmh * (1 - (t - JOLT_MS) / stopMs)),
  });
}
