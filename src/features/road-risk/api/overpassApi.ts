import type { AxiosInstance } from 'axios';

import { parseResponse } from '@/common/lib/api/apiError';

import { overpassResponseSchema, type Bounds } from '../types/roadRisk.types';

const ROAD_CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
];

const HAZARD_FILTERS = [
  'node["traffic_calming"]', 'node["highway"="speed_camera"]', 'node["hazard"]',
  'node["amenity"="school"]', 'way["amenity"="school"]',
];

export function roadQuery({ south, west, north, east }: Bounds) {
  const box = [south, west, north, east].map((value) => value.toFixed(5)).join(',');
  return `[out:json][timeout:25];(way["highway"~"^(${ROAD_CLASSES.join('|')})$"](${box});${HAZARD_FILTERS.map((filter) => `${filter}(${box});`).join('')});out body geom;`;
}

export function createOverpassApi(client: AxiosInstance) {
  // The public server has few slots for each client, so requests go one at a time.
  let tail: Promise<unknown> = Promise.resolve();

  return {
    roads(bounds: Bounds) {
      const result = tail.then(() => parseResponse(
        client.post('', `data=${encodeURIComponent(roadQuery(bounds))}`),
        overpassResponseSchema,
      ));
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

export type OverpassApi = ReturnType<typeof createOverpassApi>;
