import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useCurrentLocation, useCurrentSpeed } from '@/features/location/hooks/useLocation';
import { useCurrentRoad } from '@/features/roads/hooks/useRoad';
import { useWeather } from '@/features/weather/hooks/useWeather';

import { incidentsQuery, roadsQuery } from '../api/roadRiskQueries';
import { hazardsAhead } from '../utils/roadHazards';
import { scoreArea, scoreSegment, type RiskContext } from '../utils/roadRiskModel';
import { findCurrentSegment, riskAreaAround } from '../utils/roadSegments';


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
  const fix = useCurrentLocation();
  const speedKmh = useCurrentSpeed();
  const { road } = useCurrentRoad();
  const { riskInputs } = useWeather();
  const now = useRiskClock();
  const area = fix ? riskAreaAround(fix) : null;

  const roads = useQuery({ ...roadsQuery(area), enabled: area !== null });
  const incidents = useQuery({ ...incidentsQuery(area), enabled: area !== null });

  const segments = roads.data?.segments;
  const hazards = roads.data?.hazards;
  const context = useMemo<RiskContext>(() => ({
    now, weather: riskInputs ?? null, incidents: incidents.data?.incidents ?? [],
  }), [now, riskInputs, incidents.data]);

  const risks = useMemo(() => (segments ? scoreArea(segments, context) : []), [segments, context]);
  const currentSegment = useMemo(
    () => (segments && fix ? findCurrentSegment(segments, fix, road?.name ?? null) : null),
    [segments, fix, road?.name],
  );
  const current = useMemo(
    () => (currentSegment ? scoreSegment(currentSegment, { ...context, speedKmh }) : null),
    [currentSegment, context, speedKmh],
  );

  const nearbyHazards = useMemo(() => (
    hazards && fix ? hazardsAhead(hazards, fix) : []
  ), [hazards, fix]);

  return {
    segments: segments ?? [],
    hazards: nearbyHazards,
    risks,
    current,
    currentSegment,
    loading: roads.isLoading,
    sources: {
      roads: segments !== undefined,
      weather: riskInputs?.available === true,
      incidents: incidents.data !== undefined,
    },
  };
}
