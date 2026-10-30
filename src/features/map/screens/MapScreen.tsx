import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/common/components/ui/icon';
import { BottomTabInset, Colors, Radius, Shadow, Space } from '@/common/lib/theme';
import { useCurrentLocation } from '@/features/location/hooks/useLocation';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

import type { MapCanvas as MapCanvasType, MapCanvasHandle } from '../components/MapCanvas';
import { RoadInfoCard } from '../components/RoadInfoCard';
import { isMapAvailable } from '../utils/mapAvailability';
import { EMPTY_OVERLAYS } from '../utils/mapOverlays';

export function MapScreen() {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const fix = useCurrentLocation();
  const canvas = useRef<MapCanvasHandle>(null);
  const [following, setFollowing] = useState(true);

  if (!isMapAvailable()) {
    return <PlaceholderScreen title={t('map.title')} description={t('map.unavailable')} />;
  }

  // Loaded here, because Expo Go has no MapLibre and must still open this tab.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MapCanvas } = require('../components/MapCanvas') as { MapCanvas: typeof MapCanvasType };

  const recenter = () => {
    setFollowing(true);
    canvas.current?.recenter(fix ? [fix.longitude, fix.latitude] : null);
  };

  return (
    <View style={styles.root}>
      <MapCanvas ref={canvas} following={following} overlays={EMPTY_OVERLAYS} onFollowingChange={setFollowing} />
      <View pointerEvents="box-none" style={[styles.top, { top: top + Space[3] }]}>
        <RoadInfoCard />
      </View>
      {!following && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.recenter')}
          onPress={recenter}
          style={({ pressed }) => [styles.recenter, pressed && styles.pressed]}>
          <Icon name="location" size={22} color={Colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  top: { position: 'absolute', start: Space[4], end: Space[4] },
  recenter: {
    position: 'absolute',
    end: Space[4],
    bottom: BottomTabInset + Space[6],
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    boxShadow: Shadow.md,
  },
  pressed: { backgroundColor: Colors.accentSoft },
});
