import { distanceMeters } from '@/features/location/utils/location.utils';

import type { Bounds, OverpassResponse, RiskPoint, RoadSegment } from '../types/roadRisk.types';

// Short enough that a map highlights the bend itself, not the whole road.
const MAX_SEGMENT_METERS = 500;
const MIN_LENGTH_FOR_CURVATURE_METERS = 50;
const MIN_EDGE_METERS = 2;
const CURRENT_ROAD_RADIUS_METERS = 40;
// Roughly 2 km across. Overpass asks for few requests, and driving fills this slowly.
const AREA_CELL_DEGREES = 0.02;
// Beyond this the map is too far out to be worth the public server's time.
export const MAX_VISIBLE_AREAS = 6;

const MILES_TO_KM = 1.609344;

function parseMaxSpeed(value: string | undefined): number | null {
  const match = value?.match(/^(\d+(?:\.\d+)?)(\s*mph)?$/);
  if (!match) return null;
  return Math.round(Number(match[1]) * (match[2] ? MILES_TO_KM : 1));
}

function parseLit(value: string | undefined): boolean | null {
  if (value === 'yes') return true;
  return value === 'no' ? false : null;
}

const pathLength = (points: RiskPoint[]) => points.slice(1).reduce(
  (total, point, index) => total + distanceMeters(points[index], point), 0,
);

export function bearing(from: RiskPoint, to: RiskPoint) {
  const scale = Math.cos((from.latitude * Math.PI) / 180);
  return (Math.atan2((to.longitude - from.longitude) * scale, to.latitude - from.latitude) * 180) / Math.PI;
}

// The total turning along the road, per kilometre.
function curvature(points: RiskPoint[], lengthMeters: number) {
  if (lengthMeters < MIN_LENGTH_FOR_CURVATURE_METERS) return 0;
  const edges = points.slice(1).map((point, index) => [points[index], point])
    .filter(([from, to]) => distanceMeters(from, to) >= MIN_EDGE_METERS);
  let turning = 0;
  for (let index = 1; index < edges.length; index += 1) {
    const change = Math.abs(bearing(...edges[index] as [RiskPoint, RiskPoint]) - bearing(...edges[index - 1] as [RiskPoint, RiskPoint]));
    turning += Math.min(change, 360 - change);
  }
  return turning / (lengthMeters / 1000);
}

export function toRoadSegments({ elements }: OverpassResponse): RoadSegment[] {
  const roads = elements.filter(({ type, tags }) => type === 'way' && tags.highway);
  const nodeUse = new Map<number, number>();
  for (const { nodes } of roads) for (const node of nodes) nodeUse.set(node, (nodeUse.get(node) ?? 0) + 1);

  return roads.flatMap(({ id, nodes, geometry, tags }) => {
    const points = geometry.map(({ lat, lon }) => ({ latitude: lat, longitude: lon }));
    if (points.length < 2) return [];

    const chunks: [number, number][] = [];
    let start = 0;
    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
      length += distanceMeters(points[index - 1], points[index]);
      if (length >= MAX_SEGMENT_METERS || index === points.length - 1) {
        chunks.push([start, index]);
        start = index;
        length = 0;
      }
    }

    return chunks.map(([from, to], index) => {
      const coordinates = points.slice(from, to + 1);
      const lengthMeters = pathLength(coordinates);
      return {
        id: `${id}:${index}`,
        name: tags.name ?? tags.ref ?? null,
        roadClass: tags.highway ?? 'unclassified',
        coordinates,
        lengthMeters,
        curvatureDegreesPerKm: curvature(coordinates, lengthMeters),
        // A chunk owns its first node, so a shared end is counted once.
        junctionCount: nodes.slice(from, index === chunks.length - 1 ? to + 1 : to)
          .filter((node) => (nodeUse.get(node) ?? 0) > 1).length,
        maxSpeedKmh: parseMaxSpeed(tags.maxspeed),
        lit: parseLit(tags.lit),
      };
    });
  });
}

// Meters from a point to a road, on a local flat projection.
export function distanceToSegment(point: RiskPoint, { coordinates }: Pick<RoadSegment, 'coordinates'>) {
  const scale = Math.cos((point.latitude * Math.PI) / 180);
  const toLocal = ({ latitude, longitude }: RiskPoint) => [
    (longitude - point.longitude) * scale * 111_320, (latitude - point.latitude) * 111_320,
  ];
  let nearest = Infinity;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [ax, ay] = toLocal(coordinates[index - 1]);
    const [bx, by] = toLocal(coordinates[index]);
    const dx = bx - ax;
    const dy = by - ay;
    const span = dx * dx + dy * dy;
    const t = span === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / span));
    nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return nearest;
}

// A road running alongside can be nearer, so the matched road name decides first.
export function findCurrentSegment(segments: RoadSegment[], point: RiskPoint, roadName: string | null) {
  const nearby = segments
    .map((segment) => ({ segment, distance: distanceToSegment(point, segment) }))
    .filter(({ distance }) => distance <= CURRENT_ROAD_RADIUS_METERS)
    .sort((a, b) => a.distance - b.distance);
  return (nearby.find(({ segment }) => roadName !== null && segment.name === roadName) ?? nearby[0])?.segment ?? null;
}

export interface RiskArea {
  id: string;
  bounds: Bounds;
  center: RiskPoint;
}

export function riskAreaAround({ latitude, longitude }: RiskPoint): RiskArea {
  const row = Math.floor(latitude / AREA_CELL_DEGREES);
  const column = Math.floor(longitude / AREA_CELL_DEGREES);
  const south = row * AREA_CELL_DEGREES;
  const west = column * AREA_CELL_DEGREES;
  return {
    id: `${row}:${column}`,
    bounds: { south, west, north: south + AREA_CELL_DEGREES, east: west + AREA_CELL_DEGREES },
    center: { latitude: south + AREA_CELL_DEGREES / 2, longitude: west + AREA_CELL_DEGREES / 2 },
  };
}

// The areas on screen, or null when there are too many to load.
export function riskAreasInView({ south, west, north, east }: Bounds): RiskArea[] | null {
  const firstRow = Math.floor(south / AREA_CELL_DEGREES);
  const lastRow = Math.floor(north / AREA_CELL_DEGREES);
  const firstColumn = Math.floor(west / AREA_CELL_DEGREES);
  const lastColumn = Math.floor(east / AREA_CELL_DEGREES);
  if ((lastRow - firstRow + 1) * (lastColumn - firstColumn + 1) > MAX_VISIBLE_AREAS) return null;

  const areas: RiskArea[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      areas.push(riskAreaAround({
        latitude: (row + 0.5) * AREA_CELL_DEGREES, longitude: (column + 0.5) * AREA_CELL_DEGREES,
      }));
    }
  }
  return areas;
}
