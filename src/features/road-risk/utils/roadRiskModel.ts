import type { Incident } from '@/features/safety/types/safety.schemas';
import type { WeatherRiskInputs } from '@/features/weather/types/weather.types';

import type { RiskFactor, RiskFactorId, RiskLevel, RoadSegment, SegmentRisk } from '../types/roadRisk.types';
import { distanceToSegment } from './roadSegments';

export const ROAD_RISK_MODEL = 'road-risk-heuristic-v1';

// Every number here is a judgement, not a value fitted to accident data. See docs/road-risk.md.
const ROAD_CLASS_RISK: Record<string, number> = {
  motorway: 0.1, trunk: 0.25, primary: 0.25, secondary: 0.2, tertiary: 0.15, unclassified: 0.15,
};
const DEFAULT_ROAD_CLASS_RISK = 0.08;
const SEVERITY_RISK = { minor: 0.05, serious: 0.1, critical: 0.15 };
const MAX_INCIDENT_RISK = 0.3;
const INCIDENT_RADIUS_METERS = 100;
const INCIDENT_MAX_AGE_MS = 90 * 24 * 60 * 60_000;
const TOP_FACTORS = 3;
const MEDIUM_FROM = 0.3;
const HIGH_FROM = 0.6;

export interface RiskContext {
  now: number;
  weather: WeatherRiskInputs | null;
  incidents: Pick<Incident, 'location' | 'occurredAt' | 'severity'>[];
  speedKmh?: number | null;
}

// 0 at or under `from`, rising to `max` at `to`.
const ramp = (value: number, from: number, to: number, max: number) => (
  Math.max(0, Math.min(1, (value - from) / (to - from))) * max
);

function isDark(weather: WeatherRiskInputs | null, now: number) {
  if (typeof weather?.isDay === 'boolean') return !weather.isDay;
  const hour = new Date(now).getHours();
  return hour < 6 || hour >= 20;
}

function roadClassRisk(roadClass: string) {
  return ROAD_CLASS_RISK[roadClass.replace('_link', '')] ?? DEFAULT_ROAD_CLASS_RISK;
}

function incidentRisk(segment: RoadSegment, { incidents, now }: RiskContext) {
  const near = incidents.filter(({ location, occurredAt }) => (
    now - Date.parse(occurredAt) <= INCIDENT_MAX_AGE_MS
    && distanceToSegment(location, segment) <= INCIDENT_RADIUS_METERS
  ));
  return Math.min(MAX_INCIDENT_RISK, near.reduce((total, { severity }) => total + SEVERITY_RISK[severity], 0));
}

function speedingRisk({ maxSpeedKmh }: RoadSegment, speedKmh: number | null | undefined) {
  // Only a tagged limit counts. A guessed one could call a legal speed unsafe.
  if (!maxSpeedKmh || speedKmh === null || speedKmh === undefined) return 0;
  return ramp(speedKmh / maxSpeedKmh, 1, 1.5, 0.3);
}

export function levelFor(score: number): RiskLevel {
  if (score >= HIGH_FROM) return 'high';
  return score >= MEDIUM_FROM ? 'medium' : 'low';
}

export function scoreSegment(segment: RoadSegment, context: RiskContext): SegmentRisk {
  const { weather, now, speedKmh } = context;
  const live = weather?.available ? weather : null;
  const contributions: Partial<Record<RiskFactorId, number>> = {
    roadClass: roadClassRisk(segment.roadClass),
    curves: ramp(segment.curvatureDegreesPerKm, 100, 400, 0.25),
    junctions: ramp((segment.junctionCount / Math.max(segment.lengthMeters, 100)) * 1000, 2, 10, 0.15),
    wet: ramp(live?.precipitationMmPerHour ?? 0, 0, 4, 0.15),
    icing: live?.icingRisk === 'possible' ? 0.25 : 0,
    visibility: live?.visibilityM === null || live?.visibilityM === undefined ? 0 : 0.2 - ramp(live.visibilityM, 200, 1000, 0.2),
    wind: ramp(live?.windGustMs ?? 0, 12, 20, 0.1),
    darkness: isDark(live, now) && segment.lit !== true ? 0.15 : 0,
    speeding: speedingRisk(segment, speedKmh),
    incidents: incidentRisk(segment, context),
  };

  const all = (Object.entries(contributions) as [RiskFactorId, number][])
    .map(([id, contribution]): RiskFactor => ({ id, contribution: Math.round(contribution * 100) / 100 }))
    .filter(({ contribution }) => contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);
  const score = Math.min(1, Math.round(Object.values(contributions).reduce((sum, value) => sum + value, 0) * 100) / 100);

  return { segmentId: segment.id, score, level: levelFor(score), factors: all.slice(0, TOP_FACTORS) };
}

export const scoreArea = (segments: RoadSegment[], context: RiskContext) => (
  segments.map((segment) => scoreSegment(segment, context))
);
