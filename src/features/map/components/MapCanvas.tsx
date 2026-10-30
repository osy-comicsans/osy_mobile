import {
  Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { Colors } from '@/common/lib/theme';

import { DEFAULT_CENTER, DEFAULT_ZOOM, FOLLOW_ZOOM, mapStyleUrl } from '../utils/mapStyle';
import { toFeatureCollection, type MapOverlays } from '../utils/mapOverlays';

export interface MapCanvasHandle {
  recenter(center: [number, number] | null): void;
}

interface MapCanvasProps {
  following: boolean;
  overlays: MapOverlays;
  onFollowingChange: (following: boolean) => void;
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { following, overlays, onFollowingChange },
  ref,
) {
  const camera = useRef<CameraRef>(null);
  const scheme = useColorScheme();

  useImperativeHandle(ref, () => ({
    recenter(center) {
      if (center) camera.current?.easeTo({ center, zoom: FOLLOW_ZOOM, duration: 400 });
    },
  }));

  return (
    <Map mapStyle={mapStyleUrl(scheme)} style={StyleSheet.absoluteFill}>
      <Camera
        ref={camera}
        initialViewState={{ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }}
        trackUserLocation={following ? 'course' : undefined}
        // Dragging the map ends tracking, so the recenter button can bring it back.
        onTrackUserLocationChange={({ nativeEvent }) => onFollowingChange(nativeEvent.trackUserLocation !== null)}
      />
      <UserLocation animated heading accuracy />
      <GeoJSONSource id="risk-roads" data={toFeatureCollection(overlays['risk-roads'])}>
        <Layer id="risk-roads-line" type="line" style={{ lineColor: Colors.error, lineWidth: 5, lineOpacity: 0.7 }} />
      </GeoJSONSource>
      <GeoJSONSource id="incidents" data={toFeatureCollection(overlays.incidents)}>
        <Layer id="incidents-circle" type="circle" style={{ circleColor: Colors.error, circleRadius: 8 }} />
      </GeoJSONSource>
    </Map>
  );
});
