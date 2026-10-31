import { z } from 'zod';

import type { WeatherRiskInputs } from '@/features/weather/types/weather.types';

export const overpassResponseSchema = z.object({
  elements: z.array(z.object({
    type: z.string(),
    id: z.number(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    nodes: z.array(z.number()).default([]),
    geometry: z.array(z.object({ lat: z.number(), lon: z.number() })).default([]),
    tags: z.record(z.string(), z.string()).default({}),
  })),
});

export type OverpassResponse = z.infer<typeof overpassResponseSchema>;

export interface RiskPoint {
  latitude: number;
  longitude: number;
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface RoadSegment {
  id: string;
  name: string | null;
  roadClass: string;
  coordinates: RiskPoint[];
  lengthMeters: number;
  curvatureDegreesPerKm: number;
  junctionCount: number;
  maxSpeedKmh: number | null;
  lit: boolean | null;
}

export type RoadHazardKind = 'bump' | 'camera' | 'school' | 'animals' | 'hazard';

export interface RoadHazard {
  id: string;
  kind: RoadHazardKind;
  location: RiskPoint;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export type RiskFactorId =
  | 'roadClass' | 'curves' | 'junctions' | 'wet' | 'icing' | 'visibility'
  | 'wind' | 'darkness' | 'speeding' | 'incidents' | 'tooFast' | 'harshDriving';

export interface RiskFactor {
  id: RiskFactorId;
  contribution: number;
}

export interface SegmentRisk {
  segmentId: string;
  score: number;
  level: RiskLevel;
  // The largest contributors first, so a warning can give its reason.
  factors: RiskFactor[];
}

export interface RoadRisk {
  segments: RoadSegment[];
  hazards: (RoadHazard & { distanceMeters: number })[];
  risks: SegmentRisk[];
  current: SegmentRisk | null;
  currentSegment: RoadSegment | null;
  weather: WeatherRiskInputs | null;
  loading: boolean;
  sources: { roads: boolean; weather: boolean; incidents: boolean };
}
