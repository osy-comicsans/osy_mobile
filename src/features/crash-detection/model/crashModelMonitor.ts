import type { LocationFix } from '@/features/location/types/location.types';

import type { CrashEvent, MotionSample } from '../types/crash.types';
import { extractFeatures } from './crashFeatures';
import { buildModelWindow, IMPACT_OFFSET_SECONDS, type SpeedSample } from './modelWindow';

export interface CrashProbabilities {
  crash: number;
  nearMiss: number;
  normal: number;
}

export type CrashClassifier = (features: Float32Array) => Promise<CrashProbabilities | null>;

// The model only saw flagged events in training, never ordinary driving, so it
// runs on sharp jolts alone. This sits well under the rules' 4 g impact gate.
const CANDIDATE_G = 1.5;
const MIN_DRIVING_KMH = 20;
const STOPPED_KMH = 5;
const COOLDOWN_MS = 30_000;
const KEEP_MS = 17_000;
// The notebook has no chosen threshold, so this is its `argmax` default for now.
export const CRASH_THRESHOLD = 0.5;
export const NEAR_MISS_THRESHOLD = 0.5;

interface Candidate {
  impactAt: number;
  peak: number;
  speedBeforeKmh: number;
  location: LocationFix | null;
}

interface MonitorOptions {
  classify: CrashClassifier;
  onCrash: (event: CrashEvent) => void;
  onNearMiss: (at: number, probability: number) => void;
}

export function createCrashModelMonitor({ classify, onCrash, onNearMiss }: MonitorOptions) {
  let acceleration: MotionSample[] = [];
  let rotation: MotionSample[] = [];
  let speeds: SpeedSample[] = [];
  let lastFix: LocationFix | null = null;
  let candidate: Candidate | null = null;
  let quietUntil = 0;

  const prune = (t: number) => {
    const from = t - KEEP_MS;
    if (acceleration.length > 0 && acceleration[0].t < from - 1000) acceleration = acceleration.filter((s) => s.t >= from);
    if (rotation.length > 0 && rotation[0].t < from - 1000) rotation = rotation.filter((s) => s.t >= from);
    if (speeds.length > 1 && speeds[1].t < from) speeds = speeds.filter((s, i) => s.t >= from || speeds[i + 1]?.t >= from);
  };

  const evaluate = async ({ impactAt, peak, speedBeforeKmh, location }: Candidate) => {
    const window = buildModelWindow(acceleration, rotation, speeds, impactAt);
    const result = await classify(extractFeatures(window));
    if (!result) return;

    if (result.crash >= CRASH_THRESHOLD) {
      onCrash({
        detectedAt: impactAt + IMPACT_OFFSET_SECONDS * 1000,
        confidence: result.crash,
        source: 'model',
        snapshot: {
          impactAt,
          location,
          speedBeforeKmh,
          peakG: peak,
          vehicleStopped: (lastFix?.speedKmh ?? Infinity) <= STOPPED_KMH,
          phoneStill: false,
          rotated: false,
        },
      });
    } else if (result.nearMiss >= NEAR_MISS_THRESHOLD) {
      onNearMiss(impactAt, result.nearMiss);
    }
  };

  return {
    addAcceleration(sample: MotionSample) {
      acceleration.push(sample);
      prune(sample.t);
      const jolt = Math.abs(Math.hypot(sample.x, sample.y, sample.z) - 1);

      if (candidate) {
        if (jolt > candidate.peak && sample.t - candidate.impactAt < 1000) {
          candidate = { ...candidate, impactAt: sample.t, peak: jolt };
        }
        if (sample.t - candidate.impactAt >= IMPACT_OFFSET_SECONDS * 1000) {
          const ready = candidate;
          candidate = null;
          void evaluate(ready).catch(() => undefined);
        }
        return;
      }

      const moving = (lastFix?.speedKmh ?? 0) >= MIN_DRIVING_KMH;
      if (jolt >= CANDIDATE_G && moving && sample.t >= quietUntil) {
        quietUntil = sample.t + COOLDOWN_MS;
        candidate = { impactAt: sample.t, peak: jolt, speedBeforeKmh: lastFix?.speedKmh ?? 0, location: lastFix };
      }
    },

    addRotation(sample: MotionSample) {
      rotation.push(sample);
    },

    addFix(fix: LocationFix) {
      lastFix = fix;
      if (fix.speedKmh !== null) speeds.push({ t: fix.timestamp, kmh: fix.speedKmh });
    },

    reset() {
      acceleration = [];
      rotation = [];
      speeds = [];
      candidate = null;
    },
  };
}
