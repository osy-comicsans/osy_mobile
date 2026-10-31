import type { MotionSample, Vector3 } from '../types/crash.types';
import { SAMPLE_HZ, WINDOW_SAMPLES, WINDOW_SECONDS, type ModelWindow } from './crashFeatures';

// Where the impact sits inside the 16 seconds. The dataset's real position must be
// confirmed from its data, because the timing features depend on it.
export const IMPACT_OFFSET_SECONDS = 8;

const STEP_MS = 1000 / SAMPLE_HZ;
const GRAVITY_FROM_MS = 3_000;
const GRAVITY_TO_MS = 1_000;
const RAD_TO_DEG = 180 / Math.PI;

export interface SpeedSample {
  t: number;
  kmh: number;
}

const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a: Vector3, by: number) => ({ x: a.x * by, y: a.y * by, z: a.z * by });
const minus = (a: Vector3, b: Vector3) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vector3, b: Vector3) => ({
  x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x,
});
const unit = (a: Vector3): Vector3 | null => {
  const length = Math.sqrt(dot(a, a));
  return length > 1e-6 ? scale(a, 1 / length) : null;
};

// Vehicle axes as seen by the phone. Up comes from gravity. Forward is a best guess:
// it assumes a frontal impact, so the strongest horizontal jolt points backwards.
export function vehicleAxes(acceleration: MotionSample[], impactAt: number) {
  const before = acceleration.filter(({ t }) => t >= impactAt - GRAVITY_FROM_MS && t <= impactAt - GRAVITY_TO_MS);
  const source = before.length > 0 ? before : acceleration;
  const total = source.reduce((sum, { x, y, z }) => ({ x: sum.x + x, y: sum.y + y, z: sum.z + z }), { x: 0, y: 0, z: 0 });
  const up = unit(total) ?? { x: 0, y: 0, z: 1 };

  const horizontal = (sample: Vector3) => minus(sample, scale(up, dot(sample, up)));
  const jolt = acceleration.reduce<Vector3>((best, sample) => {
    const flat = horizontal(sample);
    return dot(flat, flat) > dot(best, best) ? flat : best;
  }, { x: 0, y: 0, z: 0 });
  const fallback = Math.abs(up.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const forward = unit(scale(jolt, -1)) ?? unit(horizontal(fallback)) as Vector3;
  return { forward, left: cross(up, forward), up };
}

function resample(
  samples: MotionSample[],
  start: number,
  axes: ReturnType<typeof vehicleAxes>,
  multiply: number,
): Float32Array {
  const signal = new Float32Array(WINDOW_SAMPLES * 3);
  if (samples.length === 0) return signal;

  let cursor = 0;
  for (let i = 0; i < WINDOW_SAMPLES; i += 1) {
    const t = start + i * STEP_MS;
    while (cursor < samples.length - 2 && samples[cursor + 1].t <= t) cursor += 1;
    const a = samples[cursor];
    const b = samples[Math.min(cursor + 1, samples.length - 1)];
    const ratio = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    const value = {
      x: a.x + (b.x - a.x) * ratio,
      y: a.y + (b.y - a.y) * ratio,
      z: a.z + (b.z - a.z) * ratio,
    };
    signal[i * 3] = dot(value, axes.forward) * multiply;
    signal[i * 3 + 1] = dot(value, axes.left) * multiply;
    signal[i * 3 + 2] = dot(value, axes.up) * multiply;
  }
  return signal;
}

function speedPerSecond(speeds: SpeedSample[], start: number): Float32Array {
  const speed = new Float32Array(WINDOW_SECONDS);
  let cursor = 0;
  for (let second = 0; second < WINDOW_SECONDS; second += 1) {
    const t = start + second * 1000;
    while (cursor < speeds.length - 1 && speeds[cursor + 1].t <= t) cursor += 1;
    speed[second] = speeds[cursor]?.kmh ?? 0;
  }
  return speed;
}

// The model was trained at 100 Hz in a fixed vehicle frame, and the phone is neither.
export function buildModelWindow(
  acceleration: MotionSample[],
  rotation: MotionSample[],
  speeds: SpeedSample[],
  impactAt: number,
): ModelWindow {
  const start = impactAt - IMPACT_OFFSET_SECONDS * 1000;
  const axes = vehicleAxes(acceleration, impactAt);
  return {
    acceleration: resample(acceleration, start, axes, 1),
    rotation: resample(rotation, start, axes, RAD_TO_DEG),
    speed: speedPerSecond(speeds, start),
  };
}
