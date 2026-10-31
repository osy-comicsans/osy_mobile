import { z } from 'zod';

const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const incidentRequestSchema = z.object({
  // Generated on the device, so a queued report can be retried safely.
  id: z.uuid(),
  source: z.enum(['user_report', 'crash_detected']),
  location: coordinateSchema,
  occurredAt: z.iso.datetime({ offset: true }),
  type: z.string().min(1),
  severity: z.enum(['minor', 'serious', 'critical']),
  injuriesVisible: z.boolean().nullable(),
  note: z.string().max(500).nullable(),
});

// Only what a nearby driver needs to find the car. Never a plate, phone number or
// medical detail, and only when the driver agreed to share it.
export const incidentInvolvedSchema = z.object({
  firstName: z.string().trim().min(1).max(50).nullable(),
  vehicle: z.string().trim().min(1).max(150).nullable(),
});

export const incidentSchema = incidentRequestSchema.omit({ note: true }).extend({
  involved: incidentInvolvedSchema.nullable().optional(),
  roadName: z.string().nullable(),
  distanceMeters: z.number().nullable(),
});

export const nearbyIncidentsQuerySchema = coordinateSchema.extend({
  radiusKm: z.number().positive(),
});

export const nearbyIncidentsResponseSchema = z.object({ incidents: z.array(incidentSchema) });

export const escalationRequestSchema = z.object({
  id: z.uuid(),
  incidentId: z.uuid(),
  trigger: z.enum(['user_requested', 'check_in_timeout']),
  location: coordinateSchema,
  speedBeforeImpactKmh: z.number().nullable(),
  roadName: z.string().nullable(),
  roadNumber: z.string().nullable(),
  shareMedicalInfo: z.boolean(),
});

export const escalationResponseSchema = z.object({
  id: z.uuid(),
  status: z.enum(['escalating', 'resolved', 'canceled']),
  liveLocationUrl: z.url().nullable(),
});

export type IncidentRequest = z.infer<typeof incidentRequestSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type NearbyIncidentsQuery = z.infer<typeof nearbyIncidentsQuerySchema>;
export type EscalationRequest = z.infer<typeof escalationRequestSchema>;
export type EscalationResponse = z.infer<typeof escalationResponseSchema>;
