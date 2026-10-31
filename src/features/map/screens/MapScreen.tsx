import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/common/components/ui/icon';
import { BottomTabInset, Colors, Radius, Shadow, Space } from '@/common/lib/theme';
import { useCurrentLocation } from '@/features/location/hooks/useLocation';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { useVisibleRoadRisk } from '@/features/road-risk/hooks/useVisibleRoadRisk';
import type { Bounds } from '@/features/road-risk/types/roadRisk.types';
import { riskAreasInView, type RiskArea } from '@/features/road-risk/utils/roadSegments';
import { ReportAccidentButton } from '@/features/safety/components/ReportAccidentButton';

import type { MapCanvas as MapCanvasType, MapCanvasHandle } from '../components/MapCanvas';
import { RiskLegend } from '../components/RiskLegend';
import { RiskRoadCard } from '../components/RiskRoadCard';
import { RoadInfoCard } from '../components/RoadInfoCard';
import { isMapAvailable } from '../utils/mapAvailability';
import { EMPTY_OVERLAYS, type MapOverlays } from '../utils/mapOverlays';

// Waits for a pan to settle, so a drag sends no requests and moves no state.
const VIEW_SETTLE_MS = 600;
const sameAreas = (a: RiskArea[] | null, b: RiskArea[] | null) => (
  a?.map(({ id }) => id).join() === b?.map(({ id }) => id).join()
);

export function MapScreen() {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const fix = useCurrentLocation();
  const canvas = useRef<MapCanvasHandle>(null);
  const [following, setFollowing] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const [areas, setAreas] = useState<RiskArea[] | null>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const risk = useVisibleRoadRisk(showRisk ? areas ?? [] : []);
  const overlays = useMemo<MapOverlays>(
    () => (showRisk ? { ...EMPTY_OVERLAYS, 'risk-roads': risk.features, hazards: risk.hazardFeatures } : EMPTY_OVERLAYS),
    [showRisk, risk.features, risk.hazardFeatures],
  );

  useEffect(() => () => clearTimeout(settle.current), []);

  const onViewChange = useCallback((bounds: Bounds) => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const next = riskAreasInView(bounds);
      setAreas((current) => (sameAreas(current, next) ? current : next));
    }, VIEW_SETTLE_MS);
  }, []);

  if (!isMapAvailable()) {
    return (
      <PlaceholderScreen title={t('map.title')} description={t('map.unavailable')}>
        <ReportAccidentButton />
      </PlaceholderScreen>
    );
  }

  // Loaded here, because Expo Go has no MapLibre and must still open this tab.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MapCanvas } = require('../components/MapCanvas') as { MapCanvas: typeof MapCanvasType };

  const selected = selectedId ? risk.risks.get(selectedId) ?? null : null;

  const recenter = () => {
    setFollowing(true);
    canvas.current?.recenter(fix ? [fix.longitude, fix.latitude] : null);
  };

  return (
    <View style={styles.root}>
      <MapCanvas
        ref={canvas}
        following={following}
        overlays={overlays}
        onFollowingChange={setFollowing}
        onViewChange={onViewChange}
        onRoadPress={setSelectedId}
      />
      <View pointerEvents="box-none" style={[styles.top, { top: top + Space[3] }]}>
        <RoadInfoCard />
        {showRisk && selected && (
          <RiskRoadCard risk={selected} weatherKnown={risk.weatherKnown} onClose={() => setSelectedId(null)} />
        )}
      </View>
      <View style={styles.report}>
        <RiskLegend
          visible={showRisk}
          onToggle={setShowRisk}
          status={areas === null ? 'zoomIn' : risk.status}
        />
        <ReportAccidentButton />
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
  top: { position: 'absolute', start: Space[4], end: Space[4], gap: Space[2] },
  report: { position: 'absolute', start: Space[4], bottom: BottomTabInset + Space[6], alignItems: 'flex-start', gap: Space[2] },
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
