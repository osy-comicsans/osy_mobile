import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/common/components/ui/card';
import { Icon } from '@/common/components/ui/icon';
import { useTheme } from '@/common/hooks/use-theme';
import { BottomTabInset, Colors, Radius, Shadow, Space } from '@/common/lib/theme';
import { useCurrentLocation } from '@/features/location/hooks/useLocation';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { useVisibleRoadRisk } from '@/features/road-risk/hooks/useVisibleRoadRisk';
import type { Bounds } from '@/features/road-risk/types/roadRisk.types';
import { riskAreasInView, type RiskArea } from '@/features/road-risk/utils/roadSegments';
import { osrmApi } from '@/features/roads/api/osrmClient';
import { ReportAccidentButton } from '@/features/safety/components/ReportAccidentButton';
import { useRoadRisk } from '@/features/road-risk/hooks/useRoadRisk';
import { currentRoadFeatures } from '@/features/road-risk/utils/riskOverlay';
import { IncidentDetails } from '@/features/safety/components/IncidentDetails';
import { useNearbyIncident, useNearbyIncidents } from '@/features/safety/hooks/useNearbyIncidents';

import type { MapCanvas as MapCanvasType, MapCanvasHandle } from '../components/MapCanvas';
import { RiskLegend } from '../components/RiskLegend';
import { FOLLOW_ZOOM, ROUTE_ZOOM } from '../utils/mapStyle';
import { RiskRoadCard } from '../components/RiskRoadCard';
import { RoadInfoCard } from '../components/RoadInfoCard';
import { RouteCard } from '../components/RouteCard';
import { isMapAvailable } from '../utils/mapAvailability';
import { EMPTY_OVERLAYS, incidentFeatures, routeFeatures, type MapOverlays } from '../utils/mapOverlays';

// Waits for a pan to settle, so a drag sends no requests and moves no state.
const VIEW_SETTLE_MS = 600;
const sameAreas = (a: RiskArea[] | null, b: RiskArea[] | null) => (
  a?.map(({ id }) => id).join() === b?.map(({ id }) => id).join()
);

export function MapScreen() {
  const theme = useTheme();
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
  // Set by "Navigate" on a nearby accident alert.
  const { incident: incidentId } = useLocalSearchParams<{ incident?: string }>();
  const incidents = useNearbyIncidents();
  const target = useNearbyIncident(incidentId);
  const origin = fix ? { latitude: fix.latitude, longitude: fix.longitude } : null;
  const route = useQuery({
    queryKey: ['nearby', 'route', target?.id],
    enabled: target !== null && origin !== null,
    // From where the user chose to go, so the line does not move with every fix.
    queryFn: () => osrmApi.route(origin!, target!.location),
    staleTime: Infinity,
  });
  const incidentLayer = useMemo(() => incidentFeatures(incidents), [incidents]);
  const routeLayer = useMemo(() => routeFeatures(route.data?.coordinates ?? []), [route.data]);
  const { segments, currentSegment } = useRoadRisk();
  const currentRoad = useMemo(() => currentRoadFeatures(segments, currentSegment), [segments, currentSegment]);
  const overlays = useMemo<MapOverlays>(() => ({
    ...(showRisk ? { ...EMPTY_OVERLAYS, 'risk-roads': risk.features, hazards: risk.hazardFeatures } : EMPTY_OVERLAYS),
    'current-road': currentRoad,
    incidents: incidentLayer,
    route: routeLayer,
  }), [showRisk, risk.features, risk.hazardFeatures, currentRoad, incidentLayer, routeLayer]);

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
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <MapCanvas
        ref={canvas}
        dangerLabel={t('roadRisk.dangerLabel')}
        // Roads and their risk only draw close in. A route pulls back to show the accident too.
        zoom={fix ? (incidentId ? ROUTE_ZOOM : FOLLOW_ZOOM) : undefined}
        following={following}
        overlays={overlays}
        onFollowingChange={setFollowing}
        onViewChange={onViewChange}
        onRoadPress={setSelectedId}
      />
      <View pointerEvents="box-none" style={[styles.top, { top: top + Space[3] }]}>
        <RoadInfoCard />
        {target && <Card style={styles.incident}><IncidentDetails incident={target} /></Card>}
        {incidentId && (
          <RouteCard
            route={route.data ?? null}
            failed={target === null || route.isError}
            onEnd={() => router.setParams({ incident: undefined })}
          />
        )}
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
          style={({ pressed }) => [styles.recenter, { backgroundColor: pressed ? theme.accentSoft : theme.surface }]}>
          <Icon name="location" size={22} color={Colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  incident: { padding: Space[4], boxShadow: Shadow.md },
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
});
