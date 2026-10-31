import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useWeather } from '@/features/weather/hooks/useWeather';

import { incidentsQuery, roadsQuery } from '../api/roadRiskQueries';
import type { RoadHazard, RoadSegment, SegmentRisk } from '../types/roadRisk.types';
import { riskMapStatus, toHazardFeatures, toRiskFeatures, uniqueById } from '../utils/riskOverlay';
import { scoreArea, type RiskContext } from '../utils/roadRiskModel';
import type { RiskArea } from '../utils/roadSegments';
import { useRiskClock } from './useRoadRisk';

type RoadResults = { data?: { segments: RoadSegment[]; hazards: RoadHazard[] }; isLoading: boolean; isError: boolean }[];
type IncidentResults = { data?: { incidents: (RiskContext['incidents'][number] & { id: string })[] } }[];

// Outside the hook, so React Query can keep the result between renders.
const combineRoads = (results: RoadResults) => ({
  segments: uniqueById(results.flatMap(({ data }) => data?.segments ?? []), ({ id }) => id),
  hazards: uniqueById(results.flatMap(({ data }) => data?.hazards ?? []), ({ id }) => id),
  status: riskMapStatus(results),
});

const combineIncidents = (results: IncidentResults) => (
  uniqueById(results.flatMap(({ data }) => data?.incidents ?? []), ({ id }) => id)
);

export function useVisibleRoadRisk(areas: RiskArea[]) {
  const { riskInputs } = useWeather();
  const now = useRiskClock();
  const { segments, hazards, status } = useQueries({ queries: areas.map(roadsQuery), combine: combineRoads });
  const incidents = useQueries({ queries: areas.map(incidentsQuery), combine: combineIncidents });

  const risks = useMemo(() => new Map<string, SegmentRisk>(
    scoreArea(segments, { now, weather: riskInputs ?? null, incidents }).map((risk) => [risk.segmentId, risk]),
  ), [segments, now, riskInputs, incidents]);
  const features = useMemo(() => toRiskFeatures(segments, risks), [segments, risks]);

  const hazardFeatures = useMemo(() => toHazardFeatures(hazards), [hazards]);

  return { features, hazardFeatures, risks, status, weatherKnown: riskInputs?.available === true };
}
