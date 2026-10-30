import type { AxiosInstance } from 'axios';

import { parseResponse } from '@/common/lib/api/apiError';

import {
  escalationRequestSchema, escalationResponseSchema, incidentRequestSchema, incidentSchema,
  nearbyIncidentsQuerySchema, nearbyIncidentsResponseSchema,
  type EscalationRequest, type IncidentRequest, type NearbyIncidentsQuery,
} from '../types/safety.schemas';

export function createSafetyApi(client: AxiosInstance) {
  return {
    createIncident: (request: IncidentRequest) => parseResponse(
      client.post('/incidents', incidentRequestSchema.parse(request)), incidentSchema,
    ),
    getNearbyIncidents: (query: NearbyIncidentsQuery) => parseResponse(
      client.get('/incidents/nearby', { params: nearbyIncidentsQuerySchema.parse(query) }),
      nearbyIncidentsResponseSchema,
    ),
    escalate: (request: EscalationRequest) => parseResponse(
      client.post('/emergency/escalate', escalationRequestSchema.parse(request)), escalationResponseSchema,
    ),
  };
}
