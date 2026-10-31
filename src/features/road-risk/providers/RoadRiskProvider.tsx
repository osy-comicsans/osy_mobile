import { useQuery } from '@tanstack/react-query';
import { useMemo, type PropsWithChildren } from 'react';

import { useCurrentLocation, useCurrentSpeed } from '@/features/location/hooks/useLocation';
import { useCurrentRoad } from '@/features/roads/hooks/useRoad';
import { useWeather } from '@/features/weather/hooks/useWeather';

import { incidentsQuery, roadsQuery } from '../api/roadRiskQueries';
import { useRiskClock } from '../hooks/useRoadRisk';
import type { RoadRisk } from '../types/roadRisk.types';
import { hazardsAhead } from '../utils/roadHazards';
import { scoreArea, scoreSegment, type RiskContext } from '../utils/roadRiskModel';
import { findCurrentSegment, riskAreaAround } from '../utils/roadSegments';
import { RoadRiskContext } from './RoadRiskContext';

// Scores the roads once, so every screen and monitor below shares one weather reading and clock.
export function RoadRiskProvider({ children }: PropsWithChildren) {
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

  const value = useMemo<RoadRisk>(() => ({
    segments: segments ?? [],
    hazards: nearbyHazards,
    risks,
    current,
    currentSegment,
    weather: riskInputs ?? null,
    loading: roads.isLoading,
    sources: {
      roads: segments !== undefined,
      weather: riskInputs?.available === true,
      incidents: incidents.data !== undefined,
    },
  }), [segments, nearbyHazards, risks, current, currentSegment, riskInputs, roads.isLoading, incidents.data]);

  return <RoadRiskContext value={value}>{children}</RoadRiskContext>;
}
