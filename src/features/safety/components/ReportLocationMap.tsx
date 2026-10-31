import { Camera, Map } from '@maplibre/maplibre-react-native';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { Icon } from '@/common/components/ui/icon';
import { Colors } from '@/common/lib/theme';
import { DEFAULT_CENTER, DEFAULT_ZOOM, FOLLOW_ZOOM, mapStyleUrl } from '@/features/map/utils/mapStyle';

import type { ReportLocation } from '../utils/accidentReport';

interface ReportLocationMapProps {
  initial: ReportLocation | null;
  onChange: (location: ReportLocation) => void;
}

// The pin stays still and the map moves under it, which works with one thumb.
export function ReportLocationMap({ initial, onChange }: ReportLocationMapProps) {
  const scheme = useColorScheme();
  const [start] = useState(initial);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        mapStyle={mapStyleUrl(scheme)}
        style={StyleSheet.absoluteFill}
        // The first load also lands here, and that must not count as a chosen place.
        onRegionDidChange={({ nativeEvent: { center: [longitude, latitude], userInteraction } }) => {
          if (userInteraction) onChange({ latitude, longitude });
        }}>
        <Camera
          initialViewState={{
            center: start ? [start.longitude, start.latitude] : DEFAULT_CENTER,
            zoom: start ? FOLLOW_ZOOM : DEFAULT_ZOOM,
          }}
        />
      </Map>
      <View pointerEvents="none" style={styles.pin}>
        <Icon name="location" size={32} color={Colors.error} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
