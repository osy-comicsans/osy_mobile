export interface SpeedLimit {
  valueKmh: number | null;
  source: 'signed' | 'default' | 'unknown';
  updatedAt: number | null;
}

// The downloadable rules dataset is a separate issue. OSRM's travel-speed
// annotations are not legal speed limits. No national defaults are inferred.
const rules: { speedLimit: SpeedLimit } = {
  speedLimit: { valueKmh: null, source: 'unknown', updatedAt: null },
};
export function useRoadRules() { return rules; }
