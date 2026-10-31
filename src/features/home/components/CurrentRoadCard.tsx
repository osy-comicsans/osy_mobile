import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { Radius, Space } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { useCurrentArea } from '@/features/location/hooks/useCurrentArea';
import { RoadHazardList } from '@/features/roads/components/RoadHazardList';
import { useCurrentRoad } from '@/features/roads/hooks/useRoad';
import { useRoadRules } from '@/features/roads/hooks/useRoadRules';
import { useHomeLocation } from '../hooks/useHomeLocation';

export function CurrentRoadCard() {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const location = useHomeLocation();
  const { road, stale } = useCurrentRoad();
  const area = useCurrentArea();
  const { hazards } = useRoadRules();
  const roadStale = stale || !location.fresh;
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <ThemedText type="overline" themeColor="textTertiary">{t('dashboard.location.title')}</ThemedText>
        <Link href="/map" asChild><Button label={t('dashboard.location.map')} variant="text" size="small" /></Link>
      </View>
      {location.loading ? <ContentSkeleton label={t('dashboard.location.loading')} lines={2} /> : (
        <>
          {road?.refs.length ? <View style={styles.plates}>{road.refs.map((ref) => (
            <View key={ref} style={styles.plate}><ThemedText type="smallBold" style={styles.plateText}>{ref}</ThemedText></View>
          ))}</View> : null}
          <ThemedText type="heading" themeColor={roadStale ? 'textSecondary' : 'textPrimary'}>
            {road?.name ?? t('dashboard.location.roadUnknown')}
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary">{area.area?.label ?? t(area.loading ? 'dashboard.location.areaLoading' : 'dashboard.location.areaUnknown')}</ThemedText>
          {road && roadStale || ((area.stale || !location.fresh) && area.area) ? <View style={styles.stale}>
            <ThemedText type="small" themeColor="textSecondary">{t(road && roadStale ? 'dashboard.location.lastRoad' : 'dashboard.location.lastArea')}</ThemedText>
          </View> : null}
          <RoadHazardList hazards={hazards} />
          {location.fix ? null : <ThemedText type="label" themeColor="textSecondary">{t(`dashboard.location.${location.status}`)}</ThemedText>}
        </>
      )}
      <ThemedText type="small" themeColor="textTertiary">{t('dashboard.location.attribution')}</ThemedText>
    </Card>
  );
}

const makeStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  card: { gap: Space[3] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Space[2] },
  stale: { alignSelf: 'flex-start', paddingHorizontal: Space[3], paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.backgroundElement },
  plates: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  plate: { paddingHorizontal: Space[3], paddingVertical: Space[1], backgroundColor: Colors.accent, borderRadius: Radius.sm },
  plateText: { color: Colors.onAccent },
});
