import {
  Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { Colors } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';

import { DEFAULT_CENTER, DEFAULT_ZOOM, FOLLOW_ZOOM, mapStyleUrl } from '../utils/mapStyle';
import { toFeatureCollection, type MapOverlays } from '../utils/mapOverlays';

export interface MapCanvasHandle {
  recenter(center: [number, number] | null): void;
}

interface MapCanvasProps {
  following: boolean;
  overlays: MapOverlays;
  onFollowingChange: (following: boolean) => void;
  onViewChange: (bounds: Bounds) => void;
  onRoadPress: (segmentId: string) => void;
}

const RISK_HITBOX = { top: 12, right: 12, bottom: 12, left: 12 };

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { following, overlays, onFollowingChange, onViewChange, onRoadPress },
  ref,
) {
  const camera = useRef<CameraRef>(null);
  const theme = useTheme();
  const scheme = theme.background === Colors.background ? 'light' : 'dark';

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
            lineWidth: 5,
            lineOpacity: 0.7,
          }}
        />
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
      <GeoJSONSource id="incidents" data={toFeatureCollection(overlays.incidents)}>
        <Layer id="incidents-circle" type="circle" style={{ circleColor: Colors.error, circleRadius: 8 }} />
      </GeoJSONSource>
    </Map>
  );
});
