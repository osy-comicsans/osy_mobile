import { Colors, Palette } from '@/common/lib/tokens';
import type { OverlayFeature } from '@/features/map/utils/mapOverlays';

import type { RiskLevel, RoadHazard, RoadHazardKind, RoadSegment, SegmentRisk } from '../types/roadRisk.types';

export const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high'];

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: Colors.success,
  medium: Colors.warning,
  high: Colors.error,
};

export const HAZARD_COLORS: Record<RoadHazardKind, string> = {
  bump: Colors.warning,
  camera: Colors.accent,
  school: Palette.purple[300],
  animals: Colors.success,
  hazard: Colors.error,
};

export const toHazardFeatures = (hazards: RoadHazard[]): OverlayFeature[] => hazards.map(({ id, kind, location }) => ({
  id,
  geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
  properties: { kind },
}));

// A road crossing two areas arrives in both, and must be drawn once.
export function uniqueById<T>(items: T[], idOf: (item: T) => string) {
  return [...new Map(items.map((item) => [idOf(item), item])).values()];
}

export function toRiskFeatures(segments: RoadSegment[], risks: Map<string, SegmentRisk>): OverlayFeature[] {
  return segments.flatMap(({ id, coordinates }) => {
    const risk = risks.get(id);
    if (!risk) return [];
    return [{
      id,
      geometry: {
        type: 'LineString' as const,
        coordinates: coordinates.map(({ latitude, longitude }): [number, number] => [longitude, latitude]),
      },
      properties: { level: risk.level },
    }];
  });
}

export type RiskMapStatus = 'ready' | 'loading' | 'failed';

export function riskMapStatus(queries: { isLoading: boolean; isError: boolean }[]): RiskMapStatus {
  if (queries.some(({ isLoading }) => isLoading)) return 'loading';
  return queries.some(({ isError }) => isError) ? 'failed' : 'ready';
}
