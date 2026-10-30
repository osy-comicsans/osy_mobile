import { z } from 'zod';

const stepSchema = z.object({
  name: z.string().default(''),
  ref: z.string().optional(),
  distance: z.number(),
  duration: z.number(),
  maneuver: z.object({ type: z.string(), location: z.tuple([z.number(), z.number()]) }),
});

const legSchema = z.object({
  steps: z.array(stepSchema),
  annotation: z.object({ nodes: z.array(z.number()) }).optional(),
});

export const nearestResponseSchema = z.object({
  waypoints: z.array(z.object({
    name: z.string().default(''),
    distance: z.number(),
    nodes: z.array(z.number()),
  })),
});

export const matchResponseSchema = z.object({
  matchings: z.array(z.object({ confidence: z.number(), legs: z.array(legSchema) })),
});

export const routeResponseSchema = z.object({
  routes: z.array(z.object({
    distance: z.number(),
    duration: z.number(),
    geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) }),
    legs: z.array(legSchema),
  })),
});

export type NearestResponse = z.infer<typeof nearestResponseSchema>;
export type MatchResponse = z.infer<typeof matchResponseSchema>;
export type RouteResponse = z.infer<typeof routeResponseSchema>;
export type RouteStep = z.infer<typeof stepSchema>;

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface TracePoint extends Coordinate {
  timestamp: number;
  accuracy: number | null;
}

export interface CurrentRoad {
  name: string | null;
  refs: string[];
  osmNodeIds: number[];
  updatedAt: number;
}

export interface RoadState {
  road: CurrentRoad | null;
  // The last known road, kept while matching is failing or the phone is offline.
  stale: boolean;
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Coordinate[];
  steps: RouteStep[];
}
