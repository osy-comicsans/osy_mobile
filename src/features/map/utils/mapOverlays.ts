type Position = [number, number];

export type OverlayGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] };

export type OverlayId = 'risk-roads' | 'hazards' | 'incidents' | 'route';

export interface OverlayFeature {
  id: string;
  geometry: OverlayGeometry;
  properties?: Record<string, string | number | boolean>;
}

export type MapOverlays = Record<OverlayId, OverlayFeature[]>;

// Risk highlighting (#16) and incident markers (#14) add their features here.
export const EMPTY_OVERLAYS: MapOverlays = { 'risk-roads': [], hazards: [], incidents: [], route: [] };

interface Place {
  latitude: number;
  longitude: number;
}

export function incidentFeatures(incidents: { id: string; location: Place; severity: string }[]): OverlayFeature[] {
  return incidents.map(({ id, location, severity }) => ({
    id,
    geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
    properties: { severity },
  }));
}

export function routeFeatures(path: Place[]): OverlayFeature[] {
  if (path.length < 2) return [];
  return [{
    id: 'route',
    geometry: { type: 'LineString', coordinates: path.map(({ latitude, longitude }) => [longitude, latitude]) },
  }];
}

export function toFeatureCollection(features: OverlayFeature[]) {
  return {
    type: 'FeatureCollection' as const,
    features: features.map(({ id, geometry, properties = {} }) => ({
      type: 'Feature' as const, id, geometry, properties,
    })),
  };
}
