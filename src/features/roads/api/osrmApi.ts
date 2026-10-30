import type { AxiosInstance } from 'axios';

import { parseResponse } from '@/common/lib/api/apiError';

import {
  matchResponseSchema, nearestResponseSchema, routeResponseSchema,
  type Coordinate, type Route, type TracePoint,
} from '../types/osrm.schemas';

const MIN_RADIUS_METERS = 10;
const MAX_RADIUS_METERS = 50;
const DEFAULT_RADIUS_METERS = 25;

// OSRM takes longitude first, the opposite of the rest of the app.
const position = ({ latitude, longitude }: Coordinate) => `${longitude.toFixed(6)},${latitude.toFixed(6)}`;

function radius({ accuracy }: TracePoint): number {
  const meters = accuracy ?? DEFAULT_RADIUS_METERS;
  return Math.round(Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, meters)));
}

export function createOsrmApi(client: AxiosInstance) {
  return {
    nearest: (point: Coordinate) => parseResponse(
      client.get(`/nearest/v1/driving/${position(point)}`, { params: { number: 1 } }),
      nearestResponseSchema,
    ),

    match(trace: TracePoint[]) {
      return parseResponse(
        client.get(`/match/v1/driving/${trace.map(position).join(';')}`, {
          params: {
            steps: true,
            overview: false,
            annotations: 'nodes',
            tidy: true,
            timestamps: trace.map(({ timestamp }) => Math.round(timestamp / 1000)).join(';'),
            radiuses: trace.map(radius).join(';'),
          },
        }),
        matchResponseSchema,
      );
    },

    async route(from: Coordinate, to: Coordinate): Promise<Route> {
      const { routes } = await parseResponse(
        client.get(`/route/v1/driving/${position(from)};${position(to)}`, {
          params: { overview: 'full', geometries: 'geojson', steps: true },
        }),
        routeResponseSchema,
      );
      const [route] = routes;
      return {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
        steps: route.legs.flatMap((leg) => leg.steps),
      };
    },
  };
}

export type OsrmApi = ReturnType<typeof createOsrmApi>;
