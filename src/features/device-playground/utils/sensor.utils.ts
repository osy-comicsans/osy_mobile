import type { Vector3 } from '../types/sensor.types';

export const SENSOR_INTERVAL_MS = 50;
export const UI_INTERVAL_MS = 125;
export const SHAKE_COOLDOWN_MS = 1_000;
export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const radiansToDegrees = (value: number) => value * 180 / Math.PI;
export const speedKmh = (value: number | null | undefined) => finite(value) && value >= 0 ? value * 3.6 : null;
export const formatNumber = (value: unknown, digits = 3) => finite(value) ? value.toFixed(digits) : '—';
export function magnitude(vector: Vector3 | null | undefined): number | null {
  return vector && finite(vector.x) && finite(vector.y) && finite(vector.z)
    ? Math.hypot(vector.x, vector.y, vector.z) : null;
}
export function formatTimestamp(value: number | null | undefined): string {
  if (!finite(value)) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString();
}
export function headingDirection(value: number | null | undefined): string {
  if (!finite(value) || value < 0) return 'Unavailable';
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((value % 360) / 45) % 8];
}
export function orientationLabel(value: number | undefined): string {
  return ({ 0: 'Portrait', 90: 'Landscape right', 180: 'Upside down', '-90': 'Landscape left' } as Record<number, string>)[value ?? NaN] ?? 'Unavailable';
}

export class ShakeDetector {
  threshold = 2.2;
  count = 0;
  detectedAt: number | null = null;
  private previous: number | null = null;
  begin() { this.previous = null; }
  reset() { this.count = 0; this.detectedAt = null; this.previous = null; }
  sample(vector: Vector3, now: number) {
    const strength = magnitude(vector);
    if (strength !== null) {
      const sudden = this.previous !== null && strength - this.previous >= 0.35;
      const cooled = this.detectedAt === null || now - this.detectedAt >= SHAKE_COOLDOWN_MS;
      if (sudden && strength >= this.threshold && cooled) { this.count++; this.detectedAt = now; }
      this.previous = strength;
    }
    return { magnitude: strength, count: this.count, detectedAt: this.detectedAt };
  }
}

export class StepCounter {
  private offset = 0;
  private latest: number | null = null;
  sample(raw: number) {
    if (finite(raw) && raw >= 0) this.latest = raw;
    return this.read();
  }
  reset() { this.offset = this.latest ?? 0; return this.read(); }
  read() { return { steps: Math.max(0, (this.latest ?? 0) - this.offset), rawSteps: this.latest }; }
}
