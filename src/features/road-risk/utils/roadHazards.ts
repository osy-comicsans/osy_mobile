import { distanceMeters } from '@/features/location/utils/location.utils';

import type { OverpassResponse, RiskPoint, RoadHazard, RoadHazardKind } from '../types/roadRisk.types';
import { bearing } from './roadSegments';

const AHEAD_METERS = 300;
const VERY_CLOSE_METERS = 30;
const AHEAD_ANGLE_DEGREES = 75;
const MIN_SPEED_FOR_HEADING_KMH = 10;
const MAX_SHOWN = 3;

function hazardKind(tags: Record<string, string>): RoadHazardKind | null {
  if (tags.traffic_calming) return 'bump';
  if (tags.highway === 'speed_camera') return 'camera';
  if (tags.amenity === 'school') return 'school';
  if (tags.hazard === 'animal_crossing') return 'animals';
  return tags.hazard ? 'hazard' : null;
}

export function toRoadHazards({ elements }: OverpassResponse): RoadHazard[] {
  return elements.flatMap(({ type, id, lat, lon, geometry, tags }) => {
    const kind = hazardKind(tags);
    const latitude = lat ?? geometry[0]?.lat;
    const longitude = lon ?? geometry[0]?.lon;
    if (!kind || latitude === undefined || longitude === undefined) return [];
    return [{ id: `${type}:${id}`, kind, location: { latitude, longitude } }];
  });
}

interface HazardViewer extends RiskPoint {
  heading: number | null;
  speedKmh: number | null;
}

// With no reliable heading, everything close by counts as ahead.
export function hazardsAhead(hazards: RoadHazard[], viewer: HazardViewer) {
  const { heading, speedKmh } = viewer;
  const moving = heading !== null && (speedKmh ?? 0) >= MIN_SPEED_FOR_HEADING_KMH;
  return hazards
    .map((hazard) => ({ ...hazard, distanceMeters: distanceMeters(viewer, hazard.location) }))
    .filter(({ location, distanceMeters: distance }) => {
      if (distance > AHEAD_METERS) return false;
      if (!moving || distance <= VERY_CLOSE_METERS) return true;
      const turn = Math.abs(bearing(viewer, location) - heading) % 360;
      return Math.min(turn, 360 - turn) <= AHEAD_ANGLE_DEGREES;
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_SHOWN);
}
