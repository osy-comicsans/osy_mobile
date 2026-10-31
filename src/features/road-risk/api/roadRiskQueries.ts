import { api } from '@/common/lib/api/axios';
import { createSafetyApi } from '@/features/safety/api/safetyApi';

import { toRoadHazards } from '../utils/roadHazards';
import { toRoadSegments, type RiskArea } from '../utils/roadSegments';
import { overpassApi } from './overpassClient';

const safetyApi = createSafetyApi(api);
const ROADS_FRESH_MS = 24 * 60 * 60_000;
const INCIDENTS_FRESH_MS = 5 * 60_000;
const INCIDENT_RADIUS_KM = 3;

// Shared keys, so the map and the driver's own road use one copy of an area.
export const roadsQuery = (area: RiskArea | null) => ({
  queryKey: ['road-risk', 'roads', area?.id],
  staleTime: ROADS_FRESH_MS,
  gcTime: ROADS_FRESH_MS,
  queryFn: async () => {
    const response = await overpassApi.roads(area!.bounds);
    return { segments: toRoadSegments(response), hazards: toRoadHazards(response) };
  },
});

export const incidentsQuery = (area: RiskArea | null) => ({
  queryKey: ['road-risk', 'incidents', area?.id],
  staleTime: INCIDENTS_FRESH_MS,
  queryFn: () => safetyApi.getNearbyIncidents({ ...area!.center, radiusKm: INCIDENT_RADIUS_KM }),
});
