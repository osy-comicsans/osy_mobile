import { useRoadRisk } from '@/features/road-risk/hooks/useRoadRisk';

export interface SpeedLimit {
  valueKmh: number | null;
  source: 'signed' | 'unknown';
  updatedAt: number | null;
}

// Limits and hazards come from OpenStreetMap through Overpass. OSRM's
// travel-speed annotations are not legal limits, and no national defaults are inferred.
export function useRoadRules() {
  const { currentSegment, hazards } = useRoadRisk();
  const valueKmh = currentSegment?.maxSpeedKmh ?? null;
  const speedLimit: SpeedLimit = { valueKmh, source: valueKmh === null ? 'unknown' : 'signed', updatedAt: null };
  return { speedLimit, hazards };
}
