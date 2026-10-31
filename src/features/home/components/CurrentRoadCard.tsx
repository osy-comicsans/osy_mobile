import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { formatDateTime, formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
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
  const language = getLanguage();
  const number = (value: number) => formatNumber(language, value, { maximumFractionDigits: 4 });
  const roadStale = stale || !location.fresh;
  return (
    <Card glass style={styles.card}>
      <View style={styles.row}>
        <ThemedText type="headingS">{t('dashboard.location.title')}</ThemedText>
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
          <ThemedText type="body" themeColor="textSecondary">{area.area?.label ?? t(area.loading ? 'dashboard.location.areaLoading' : 'dashboard.location.areaUnknown')}</ThemedText>
          {(area.stale || !location.fresh) && area.area ? <ThemedText type="small" themeColor="textSecondary">{t('dashboard.location.lastArea')}</ThemedText> : null}
          {road && roadStale ? <ThemedText type="small" themeColor="textSecondary">{t('dashboard.location.lastRoad')}</ThemedText> : null}
          <RoadHazardList hazards={hazards} />
          {location.fix ? (
            <>
              <ThemedText type="label" themeColor="textSecondary">{t('dashboard.location.coordinates', {
                latitude: number(location.fix.latitude), longitude: number(location.fix.longitude),
              })}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{t('dashboard.location.updated', {
                time: formatDateTime(language, new Date(location.fix.timestamp), { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              })}</ThemedText>
            </>
          ) : <ThemedText type="label" themeColor="textSecondary">{t(`dashboard.location.${location.status}`)}</ThemedText>}
          {location.heading !== null ? <ThemedText type="label" themeColor="textSecondary">{t('dashboard.location.heading', { value: number(location.heading) })}</ThemedText> : null}
        </>
      )}
      <Link href="https://www.openstreetmap.org/copyright" asChild>
        <Button label={t('dashboard.location.attribution')} variant="text" size="small" />
      </Link>
    </Card>
  );
}

const makeStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  card: { gap: Space[3] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Space[2] },
  plates: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  plate: { paddingHorizontal: Space[3], paddingVertical: Space[1], backgroundColor: Colors.accent, borderRadius: Radius.sm },
  plateText: { color: Colors.onAccent },
});
