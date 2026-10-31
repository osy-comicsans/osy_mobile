import { distanceMeters } from '@/features/location/utils/location.utils';
import type { WeatherRiskInputs } from '@/features/weather/types/weather.types';

import type { RiskFactor, RiskPoint, RoadSegment, SegmentRisk } from '../types/roadRisk.types';
import { bearing } from './roadSegments';

// Every number here is a starting judgement, to tune on real drives. See docs/road-risk.md.
const ADVISORY_SPEED_KMH: Record<string, number> = {
  motorway: 120, trunk: 100, primary: 80, secondary: 70, tertiary: 60, unclassified: 50,
};
const DEFAULT_ADVISORY_SPEED_KMH = 40;
const WARN_FROM = 0.7;
const REARM_BELOW = 0.55;
// Two updates in a row, so one bad GPS reading cannot speak to the driver.
const CONFIRMATIONS_TO_WARN = 2;
const MIN_WARNING_SPEED_KMH = 30;
const WARNING_GAP_MS = 2 * 60_000;
const SAME_ROAD_GAP_MS = 30 * 60_000;
const HOUR_MS = 60 * 60_000;
const MAX_WARNINGS_PER_HOUR = 6;
const LOOKAHEAD_SECONDS = 12;
const MIN_LOOKAHEAD_METERS = 150;
const MAX_LOOKAHEAD_METERS = 500;
const AHEAD_ANGLE_DEGREES = 40;
const MAX_TOO_FAST_RISK = 0.35;
const HARSH_DRIVING_RISK = 0.15;
const HARSH_BRAKING_MS2 = 3.5;
const HARSH_CORNERING_MS2 = 4;
const MIN_CORNERING_SPEED_MS = 8;
const MIN_SPEED_GAP_MS = 500;
const MAX_SPEED_GAP_MS = 3_000;
const HARSH_MEMORY_MS = 2 * 60_000;

// Advice for the conditions, and never shown as a legal limit.
export function safeSpeedKmh({ roadClass, maxSpeedKmh, curvatureDegreesPerKm }: RoadSegment, weather: WeatherRiskInputs | null) {
  const base = ADVISORY_SPEED_KMH[roadClass.replace('_link', '')] ?? DEFAULT_ADVISORY_SPEED_KMH;
  let speed = maxSpeedKmh === null ? base : Math.min(base, maxSpeedKmh);
  if (curvatureDegreesPerKm >= 400) speed *= 0.65;
  else if (curvatureDegreesPerKm >= 200) speed *= 0.8;
  if (weather?.available) {
    if (weather.icingRisk === 'possible') speed *= 0.6;
    else if ((weather.precipitationMmPerHour ?? 0) > 0) speed *= 0.85;
    if (weather.visibilityM !== null && weather.visibilityM < 1000) speed *= 0.7;
  }
  return speed;
}

interface Driver extends RiskPoint {
  heading: number | null;
}

// The same road ahead, so a side street at a junction does not warn the driver.
export function upcomingSegments(segments: RoadSegment[], current: RoadSegment | null, driver: Driver, speedKmh: number) {
  const { heading } = driver;
  if (heading === null) return [];
  const reach = Math.min(MAX_LOOKAHEAD_METERS, Math.max(MIN_LOOKAHEAD_METERS, (speedKmh / 3.6) * LOOKAHEAD_SECONDS));
  return segments.filter((segment) => {
    if (segment.id === current?.id || (current?.name && segment.name !== current.name)) return false;
    return segment.coordinates.some((point) => {
      if (distanceMeters(driver, point) > reach) return false;
      const turn = Math.abs(bearing(driver, point) - heading) % 360;
      return Math.min(turn, 360 - turn) <= AHEAD_ANGLE_DEGREES;
    });
  });
}

export interface DriveAssessment {
  segmentId: string;
  score: number;
  factors: RiskFactor[];
  // Fast or harsh driving. Without it, a careful driver is left alone.
  pressured: boolean;
}

interface DriveInput {
  segments: RoadSegment[];
  risks: SegmentRisk[];
  current: RoadSegment | null;
  driver: Driver;
  speedKmh: number;
  harshDriving: boolean;
  weather: WeatherRiskInputs | null;
}

export function assessDrive({ segments, risks, current, driver, speedKmh, harshDriving, weather }: DriveInput): DriveAssessment | null {
  const byId = new Map(risks.map((risk) => [risk.segmentId, risk]));
  const candidates = [...(current ? [current] : []), ...upcomingSegments(segments, current, driver, speedKmh)];

  const assessments = candidates.flatMap((segment) => {
    const risk = byId.get(segment.id);
    if (!risk) return [];
    const ratio = speedKmh / safeSpeedKmh(segment, weather);
    const tooFast = Math.max(0, Math.min(1, (ratio - 1) / 0.5)) * MAX_TOO_FAST_RISK;
    const added: RiskFactor[] = [
      ...(tooFast > 0 ? [{ id: 'tooFast' as const, contribution: Math.round(tooFast * 100) / 100 }] : []),
      ...(harshDriving ? [{ id: 'harshDriving' as const, contribution: HARSH_DRIVING_RISK }] : []),
    ];
    return [{
      segmentId: segment.id,
      score: Math.min(1, risk.score + tooFast + (harshDriving ? HARSH_DRIVING_RISK : 0)),
      factors: [...risk.factors, ...added].sort((a, b) => b.contribution - a.contribution),
      pressured: added.length > 0,
    }];
  });
  return assessments.reduce<DriveAssessment | null>((worst, next) => (!worst || next.score > worst.score ? next : worst), null);
}

// The road's type says little to a driver, so it is only a last resort.
export function warningReasons(factors: RiskFactor[]) {
  const useful = factors.filter(({ id }) => id !== 'roadClass');
  return (useful.length > 0 ? useful : factors).slice(0, 2).map(({ id }) => id);
}

export function createRiskWarningEngine() {
  const warnedRoads = new Map<string, number>();
  let warnedAt: number[] = [];
  let armed = true;
  let pendingSegment: string | null = null;
  let confirmations = 0;

  return {
    update(assessment: DriveAssessment | null, speedKmh: number, now: number) {
      warnedAt = warnedAt.filter((time) => now - time < HOUR_MS);
      for (const [id, time] of warnedRoads) if (now - time >= SAME_ROAD_GAP_MS) warnedRoads.delete(id);

      if (!assessment || assessment.score < REARM_BELOW) armed = true;
      const qualifies = assessment !== null && assessment.score >= WARN_FROM && assessment.pressured
        && speedKmh >= MIN_WARNING_SPEED_KMH;
      if (!qualifies) {
        pendingSegment = null;
        confirmations = 0;
        return null;
      }

      confirmations = pendingSegment === assessment.segmentId ? confirmations + 1 : 1;
      pendingSegment = assessment.segmentId;
      const last = warnedAt[warnedAt.length - 1];
      if (
        confirmations < CONFIRMATIONS_TO_WARN || !armed || warnedRoads.has(assessment.segmentId)
        || (last !== undefined && now - last < WARNING_GAP_MS) || warnedAt.length >= MAX_WARNINGS_PER_HOUR
      ) return null;

      armed = false;
      warnedAt.push(now);
      warnedRoads.set(assessment.segmentId, now);
      return { segmentId: assessment.segmentId, reasons: warningReasons(assessment.factors) };
    },
  };
}

interface MotionFix {
  speedMs: number | null;
  heading: number | null;
  timestamp: number;
}

// GPS only, so it sees sustained braking and cornering, not a short jolt.
export function createHarshDrivingMonitor() {
  let previous: MotionFix | null = null;
  let harshAt: number | null = null;

  return {
    add(fix: MotionFix) {
      const before = previous;
      previous = fix;
      if (!before || before.speedMs === null || fix.speedMs === null) return;
      const gap = fix.timestamp - before.timestamp;
      if (gap < MIN_SPEED_GAP_MS || gap > MAX_SPEED_GAP_MS) return;

      const seconds = gap / 1000;
      const braking = (before.speedMs - fix.speedMs) / seconds;
      let cornering = 0;
      if (before.heading !== null && fix.heading !== null && fix.speedMs >= MIN_CORNERING_SPEED_MS) {
        const change = Math.abs(fix.heading - before.heading) % 360;
        cornering = ((Math.min(change, 360 - change) * Math.PI) / 180 / seconds) * fix.speedMs;
      }
      if (braking >= HARSH_BRAKING_MS2 || cornering >= HARSH_CORNERING_MS2) harshAt = fix.timestamp;
    },

    isRecent: (now: number) => harshAt !== null && now - harshAt <= HARSH_MEMORY_MS,
  };
}
