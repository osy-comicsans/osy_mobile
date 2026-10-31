import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { api } from '@/common/lib/api/axios';
import { useCurrentLocation, useCurrentSpeed } from '@/features/location/hooks/useLocation';
import { useCurrentRoad } from '@/features/roads/hooks/useRoad';
import { createSafetyApi } from '@/features/safety/api/safetyApi';
import { useWeather } from '@/features/weather/hooks/useWeather';

import { overpassApi } from '../api/overpassClient';
import { scoreArea, scoreSegment, type RiskContext } from '../utils/roadRiskModel';
import { findCurrentSegment, riskAreaAround, toRoadSegments } from '../utils/roadSegments';

const safetyApi = createSafetyApi(api);
const ROADS_FRESH_MS = 24 * 60 * 60_000;
const INCIDENTS_FRESH_MS = 5 * 60_000;
const INCIDENT_RADIUS_KM = 3;
const MINUTE_MS = 60_000;

// Risk for the roads around the driver and the road they are on. Each source is
// optional: without one the score is lower, and `sources` says what was missing.
export function useRoadRisk() {
  const fix = useCurrentLocation();
  const speedKmh = useCurrentSpeed();
  const { road } = useCurrentRoad();
  const { riskInputs } = useWeather();
  const [openedAt] = useState(Date.now);
  // Follows the drive, a minute at a time, so a new fix does not rescore every road.
  const now = Math.floor((fix?.timestamp ?? openedAt) / MINUTE_MS) * MINUTE_MS;
  const area = fix ? riskAreaAround(fix) : null;

  const roads = useQuery({
    queryKey: ['road-risk', 'roads', area?.id],
    enabled: area !== null,
    staleTime: ROADS_FRESH_MS,
    queryFn: async () => toRoadSegments(await overpassApi.roads(area!.bounds)),
  });
  const incidents = useQuery({
    queryKey: ['road-risk', 'incidents', area?.id],
    enabled: area !== null,
    staleTime: INCIDENTS_FRESH_MS,
    queryFn: () => safetyApi.getNearbyIncidents({ ...area!.center, radiusKm: INCIDENT_RADIUS_KM }),
  });

  const segments = roads.data;
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

  return {
    segments: segments ?? [],
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
