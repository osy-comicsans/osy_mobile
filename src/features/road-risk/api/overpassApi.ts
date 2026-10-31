import type { AxiosInstance } from 'axios';

import { parseResponse } from '@/common/lib/api/apiError';

import { overpassResponseSchema, type Bounds } from '../types/roadRisk.types';

const ROAD_CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
];

export function roadQuery({ south, west, north, east }: Bounds) {
  const box = [south, west, north, east].map((value) => value.toFixed(5)).join(',');
  return `[out:json][timeout:25];way["highway"~"^(${ROAD_CLASSES.join('|')})$"](${box});out body geom;`;
}

export function createOverpassApi(client: AxiosInstance) {
  return {
    roads: (bounds: Bounds) => parseResponse(
      client.post('', `data=${encodeURIComponent(roadQuery(bounds))}`),
      overpassResponseSchema,
    ),
  };
}

export type OverpassApi = ReturnType<typeof createOverpassApi>;
