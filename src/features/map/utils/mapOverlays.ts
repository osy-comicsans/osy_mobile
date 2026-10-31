type Position = [number, number];

export type OverlayGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] };

export type OverlayId = 'risk-roads' | 'hazards' | 'incidents';

export interface OverlayFeature {
  id: string;
  geometry: OverlayGeometry;
  properties?: Record<string, string | number | boolean>;
}

export type MapOverlays = Record<OverlayId, OverlayFeature[]>;

// Risk highlighting (#16) and incident markers (#14) add their features here.
export const EMPTY_OVERLAYS: MapOverlays = { 'risk-roads': [], hazards: [], incidents: [] };

export function toFeatureCollection(features: OverlayFeature[]) {
  return {
    type: 'FeatureCollection' as const,
    features: features.map(({ id, geometry, properties = {} }) => ({
      type: 'Feature' as const, id, geometry, properties,
    })),
  };
}
