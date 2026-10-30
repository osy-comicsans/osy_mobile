import type { LocationFix } from '@/features/location/types/location.types';

import type { CrashEvent, CrashTrace, MotionSample, Vector3 } from '../types/crash.types';

// Hard braking peaks near 1.5 g with gravity included, so it never opens a candidate.
const IMPACT_G = 4;
const FULL_SEVERITY_G = 8;
const IMPACT_WINDOW_MS = 1_000;

const FREE_FALL_G = 0.3;
// Nothing inside a car falls much more than a metre (about 450 ms). A longer
// fall means the vehicle itself left the ground, so it is not a dropped phone.
const DROP_MIN_MS = 100;
const DROP_MAX_MS = 600;
const DROP_LOOKBACK_MS = 300;

const MIN_DRIVING_KMH = 20;
const FULL_SPEED_KMH = 60;
const MAX_FIX_AGE_MS = 5_000;
const STOPPED_KMH = 5;
// A crash stops the vehicle almost at once, so even with GPS lag the first
// stopped fix implies hard deceleration. An ordinary stop at a light implies less.
const ABRUPT_STOP_MS2 = 2.5;
// A crashed vehicle can slide or roll on for seconds, but it does not hold most
// of its speed once GPS has caught up.
const CARRIED_ON_RATIO = 0.7;
// GPS speed trails the vehicle by about a second, so early fixes still show the old speed.
const GPS_LAG_MS = 2_000;

const DECISION_DELAY_MS = 3_000;
const DECISION_TIMEOUT_MS = 10_000;
const STILL_WINDOW_MS = 2_000;
const STILL_G = 0.1;
const STILL_RAD_S = 0.5;
const GRAVITY_FROM_MS = 1_500;
const GRAVITY_TO_MS = 300;
// Emergency braking alone tilts the measured gravity by up to about 40°.
const ROTATED_DEG = 60;
const SPIN_RAD_S = 5;
const QUIET_MS = 120_000;
const BUFFER_MS = 2_000;

// The product opens the check-in at 80% confidence. The rule-based v1 weights
// sum to 1 and are set so a confirmed stop after an impact clears it; tune
// them against recorded traces.
export const CHECK_IN_CONFIDENCE = 0.8;
const WEIGHTS = { impact: 0.45, stopped: 0.25, severity: 0.1, speed: 0.05, still: 0.1, rotated: 0.05 };

interface Candidate {
  impactAt: number;
  peakG: number;
  speedBeforeKmh: number;
  gravityBefore: Vector3 | null;
  maxRotation: number;
  stopped: boolean;
  carriedOn: boolean;
}

const magnitude = ({ x, y, z }: Vector3) => Math.hypot(x, y, z);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const within = (samples: MotionSample[], from: number, to: number) =>
  samples.filter((sample) => sample.t >= from && sample.t <= to);

function mean(samples: MotionSample[]): Vector3 | null {
  if (samples.length === 0) return null;
  const sum = samples.reduce((total, { x, y, z }) => ({ x: total.x + x, y: total.y + y, z: total.z + z }), {
    x: 0,
    y: 0,
    z: 0,
  });
  return { x: sum.x / samples.length, y: sum.y / samples.length, z: sum.z / samples.length };
}

function angleDegrees(a: Vector3, b: Vector3): number {
  const cosine = (a.x * b.x + a.y * b.y + a.z * b.z) / (magnitude(a) * magnitude(b));
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
}

function keepRecent(samples: MotionSample[], sample: MotionSample) {
  samples.push(sample);
  while (samples[0].t < sample.t - BUFFER_MS) samples.shift();
}

// An impact while driving, followed by the vehicle stopping, is a crash. A
// phone that falls freely just before the impact was dropped instead.
export function createCrashDetector() {
  const acceleration: MotionSample[] = [];
  const rotation: MotionSample[] = [];
  let lastFix: LocationFix | null = null;
  let candidate: Candidate | null = null;
  let quietUntil = 0;

  const droppedBefore = (impactAt: number) => {
    let fallStart: number | null = null;
    for (const sample of acceleration) {
      if (magnitude(sample) < FREE_FALL_G) {
        fallStart ??= sample.t;
      } else if (fallStart !== null) {
        const duration = sample.t - fallStart;
        if (duration >= DROP_MIN_MS && duration <= DROP_MAX_MS && impactAt - sample.t <= DROP_LOOKBACK_MS) {
          return true;
        }
        fallStart = null;
      }
      if (sample.t >= impactAt) break;
    }
    return false;
  };

  const open = (sample: MotionSample, g: number) => {
    const recent = lastFix && sample.t - lastFix.timestamp <= MAX_FIX_AGE_MS ? lastFix.speedKmh : null;
    if (recent === null || recent < MIN_DRIVING_KMH || droppedBefore(sample.t)) return;
    candidate = {
      impactAt: sample.t,
      peakG: g,
      speedBeforeKmh: recent,
      gravityBefore: mean(within(acceleration, sample.t - GRAVITY_FROM_MS, sample.t - GRAVITY_TO_MS)),
      maxRotation: 0,
      stopped: false,
      carriedOn: false,
    };
  };

  const conclude = (found: Candidate, now: number): CrashEvent => {
    const settled = within(acceleration, now - STILL_WINDOW_MS, now);
    const phoneStill = settled.every((sample) => Math.abs(magnitude(sample) - 1) < STILL_G)
      && within(rotation, now - STILL_WINDOW_MS, now).every((sample) => magnitude(sample) < STILL_RAD_S);
    const gravityAfter = mean(settled);
    const tilted = phoneStill && found.gravityBefore !== null && gravityAfter !== null
      && angleDegrees(found.gravityBefore, gravityAfter) >= ROTATED_DEG;
    const rotated = tilted || found.maxRotation >= SPIN_RAD_S;
    const confidence = WEIGHTS.impact
      + (found.stopped ? WEIGHTS.stopped : 0)
      + WEIGHTS.severity * clamp01((found.peakG - IMPACT_G) / (FULL_SEVERITY_G - IMPACT_G))
      + WEIGHTS.speed * clamp01((found.speedBeforeKmh - MIN_DRIVING_KMH) / (FULL_SPEED_KMH - MIN_DRIVING_KMH))
      + (phoneStill ? WEIGHTS.still : 0)
      + (rotated ? WEIGHTS.rotated : 0);
    return {
      detectedAt: now,
      confidence,
      snapshot: {
        impactAt: found.impactAt,
        location: lastFix,
        speedBeforeKmh: found.speedBeforeKmh,
        peakG: found.peakG,
        vehicleStopped: found.stopped,
        phoneStill,
        rotated,
      },
    };
  };

  const addAcceleration = (sample: MotionSample): CrashEvent | null => {
    keepRecent(acceleration, sample);
    const g = magnitude(sample);
    if (!candidate) {
      if (g >= IMPACT_G && sample.t >= quietUntil) open(sample, g);
      return null;
    }
    if (candidate.carriedOn) {
      candidate = null;
      return null;
    }
    const elapsed = sample.t - candidate.impactAt;
    if (elapsed <= IMPACT_WINDOW_MS) candidate.peakG = Math.max(candidate.peakG, g);
    if (elapsed < DECISION_TIMEOUT_MS && !(candidate.stopped && elapsed >= DECISION_DELAY_MS)) return null;
    const event = conclude(candidate, sample.t);
    candidate = null;
    quietUntil = sample.t + QUIET_MS;
    return event;
  };

  const addRotation = (sample: MotionSample) => {
    keepRecent(rotation, sample);
    if (candidate && sample.t - candidate.impactAt <= IMPACT_WINDOW_MS) {
      candidate.maxRotation = Math.max(candidate.maxRotation, magnitude(sample));
    }
  };

  const addFix = (fix: LocationFix) => {
    lastFix = fix;
    if (!candidate || fix.speedKmh === null || fix.timestamp <= candidate.impactAt) return;
    const elapsed = fix.timestamp - candidate.impactAt;
    if (fix.speedKmh <= STOPPED_KMH) {
      const deceleration = candidate.speedBeforeKmh / 3.6 / (elapsed / 1_000);
      if (deceleration >= ABRUPT_STOP_MS2) candidate.stopped = true;
    } else if (elapsed >= GPS_LAG_MS && fix.speedKmh >= candidate.speedBeforeKmh * CARRIED_ON_RATIO) {
      candidate.carriedOn = true;
    }
  };

  const reset = () => {
    acceleration.length = 0;
    rotation.length = 0;
    lastFix = null;
    candidate = null;
    quietUntil = 0;
  };

  return { addAcceleration, addRotation, addFix, reset };
}

export function replayTrace(trace: CrashTrace): CrashEvent[] {
  const detector = createCrashDetector();
  const steps: { t: number; run: () => CrashEvent | null | void }[] = [
    ...trace.fixes.map((fix) => ({ t: fix.timestamp, run: () => detector.addFix(fix) })),
    ...trace.rotation.map((sample) => ({ t: sample.t, run: () => detector.addRotation(sample) })),
    ...trace.acceleration.map((sample) => ({ t: sample.t, run: () => detector.addAcceleration(sample) })),
  ];
  return steps
    .sort((a, b) => a.t - b.t)
    .map((step) => step.run())
    .filter((event): event is CrashEvent => !!event);
}
