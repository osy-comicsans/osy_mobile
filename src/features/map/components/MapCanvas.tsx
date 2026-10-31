import {
  Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/common/hooks/use-theme';
import { Colors } from '@/common/lib/theme';
import { HAZARD_COLORS, RISK_LEVEL_COLORS } from '@/features/road-risk/utils/riskOverlay';
import type { Bounds } from '@/features/road-risk/types/roadRisk.types';

import { DEFAULT_CENTER, DEFAULT_ZOOM, FOLLOW_ZOOM, mapStyleUrl } from '../utils/mapStyle';
import { toFeatureCollection, type MapOverlays } from '../utils/mapOverlays';

export interface MapCanvasHandle {
  recenter(center: [number, number] | null): void;
}

interface MapCanvasProps {
  following: boolean;
  dangerLabel: string;
  zoom: number | undefined;
  overlays: MapOverlays;
  onFollowingChange: (following: boolean) => void;
  onViewChange: (bounds: Bounds) => void;
  onRoadPress: (segmentId: string) => void;
}

const RISK_HITBOX = { top: 12, right: 12, bottom: 12, left: 12 };

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { following, dangerLabel, zoom, overlays, onFollowingChange, onViewChange, onRoadPress },
  ref,
) {
  const camera = useRef<CameraRef>(null);
  const theme = useTheme();
  const scheme = theme.background === Colors.background ? 'light' : 'dark';
  // A new object makes MapLibre rebuild the layer, so it only changes with the roads.
  const currentRoad = useMemo(() => toFeatureCollection(overlays['current-road']), [overlays]);
  const riskRoads = useMemo(() => toFeatureCollection(overlays['risk-roads']), [overlays]);
  const hazards = useMemo(() => toFeatureCollection(overlays.hazards), [overlays]);
  const route = useMemo(() => toFeatureCollection(overlays.route), [overlays]);

  useImperativeHandle(ref, () => ({
    recenter(center) {
      if (center) camera.current?.easeTo({ center, zoom: FOLLOW_ZOOM, duration: 400 });
    },
  }));

  return (
    <Map
      mapStyle={mapStyleUrl(scheme)}
      style={StyleSheet.absoluteFill}
      onRegionDidChange={({ nativeEvent: { bounds: [west, south, east, north] } }) => {
        onViewChange({ south, west, north, east });
      }}>
      <Camera
        ref={camera}
        initialViewState={{ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }}
        zoom={zoom}
        trackUserLocation={following ? 'course' : undefined}
        // Dragging the map ends tracking, so the recenter button can bring it back.
        onTrackUserLocationChange={({ nativeEvent }) => onFollowingChange(nativeEvent.trackUserLocation !== null)}
      />
      <UserLocation animated heading accuracy />
      <GeoJSONSource
        id="risk-roads"
        data={riskRoads}
        hitbox={RISK_HITBOX}
        onPress={({ nativeEvent: { features } }) => {
          const id = features[0]?.id;
          if (id !== undefined) onRoadPress(String(id));
        }}>
        <Layer
          id="risk-roads-line"
          type="line"
          style={{
            lineColor: ['match', ['get', 'level'], 'high', RISK_LEVEL_COLORS.high, 'medium', RISK_LEVEL_COLORS.medium, RISK_LEVEL_COLORS.low],
            lineWidth: ['match', ['get', 'level'], 'high', 7, 5],
            lineOpacity: ['match', ['get', 'level'], 'high', 0.95, 0.7],
          }}
        />
        <Layer
          id="risk-roads-danger"
          type="symbol"
          filter={['==', ['get', 'level'], 'high']}
          style={{
            symbolPlacement: 'line',
            symbolSpacing: 220,
            textField: dangerLabel,
            textFont: ['Noto Sans Bold'],
            textSize: 11,
            textColor: Colors.error,
            textHaloColor: Colors.surface,
            textHaloWidth: 2,
            textOffset: [0, -1.1],
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="current-road" data={currentRoad}>
        <Layer id="current-road-casing" type="line" style={{ lineColor: Colors.surface, lineWidth: 11, lineCap: 'round', lineJoin: 'round' }} />
        <Layer id="current-road-line" type="line" style={{ lineColor: Colors.accent, lineWidth: 6, lineCap: 'round', lineJoin: 'round' }} />
      </GeoJSONSource>
      <GeoJSONSource id="hazards" data={hazards}>
        <Layer
          id="hazards-circle"
          type="circle"
          style={{
            circleColor: [
              'match', ['get', 'kind'],
              'bump', HAZARD_COLORS.bump, 'camera', HAZARD_COLORS.camera, 'school', HAZARD_COLORS.school,
              'animals', HAZARD_COLORS.animals, HAZARD_COLORS.hazard,
            ],
            circleRadius: 6,
            circleStrokeColor: Colors.surface,
            circleStrokeWidth: 2,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="route" data={route}>
        <Layer
          id="route-line"
          type="line"
          style={{ lineColor: Colors.accent, lineWidth: 6, lineOpacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="incidents" data={toFeatureCollection(overlays.incidents)}>
        <Layer id="incidents-circle" type="circle" style={{ circleColor: Colors.error, circleRadius: 8 }} />
      </GeoJSONSource>
    </Map>
  );
});
