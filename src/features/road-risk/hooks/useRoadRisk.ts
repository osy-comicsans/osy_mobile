import { useContext, useState } from 'react';

import { useCurrentLocation } from '@/features/location/hooks/useLocation';

import { RoadRiskContext } from '../providers/RoadRiskContext';

const MINUTE_MS = 60_000;

// Follows the drive, a minute at a time, so a new fix does not rescore every road.
export function useRiskClock() {
  const fix = useCurrentLocation();
  const [openedAt] = useState(Date.now);
  return Math.floor((fix?.timestamp ?? openedAt) / MINUTE_MS) * MINUTE_MS;
}

// Risk for the roads around the driver and the road they are on. Each source is
// optional: without one the score is lower, and `sources` says what was missing.
export function useRoadRisk() {
  const risk = useContext(RoadRiskContext);
  if (!risk) throw new Error('Road risk hooks require RoadRiskProvider.');
  return risk;
}
