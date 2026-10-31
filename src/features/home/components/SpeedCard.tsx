import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { ContentSkeleton, LoadingIndicator } from '@/common/components/ui/loading';
import { Radius, Space } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { useRoadRisk } from '@/features/road-risk/hooks/useRoadRisk';
import { useRoadRules } from '@/features/roads/hooks/useRoadRules';
import { useHomeLocation } from '../hooks/useHomeLocation';
import { homeSpeedLimitStatus } from '../utils/homePresentation';
import { Speedometer } from './Speedometer';
import { useSpeedDisplay } from '@/features/settings/hooks/useSpeedDisplay';

export function SpeedCard() {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const location = useHomeLocation();
  const { loading } = useRoadRisk();
  const { speedLimit } = useRoadRules();
  const limit = homeSpeedLimitStatus(location, loading, speedLimit.valueKmh);
  const limitDisplay = useSpeedDisplay(speedLimit.valueKmh);
  return (
    <Card glass style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="overline" themeColor="textSecondary">{t('dashboard.speed.title')}</ThemedText>
        <View style={styles.badge}>
          <ThemedText type="label" style={styles.accent}>{location.movement ? t(`location.driving.${location.movement}`) : t('dashboard.speed.waiting')}</ThemedText>
        </View>
      </View>
      {location.loading ? <ContentSkeleton lines={2} label={t('dashboard.speed.loading')} />
        : <Speedometer speedKmh={location.speedKmh} />}
      <View style={styles.limit}>
        <ThemedText type="label" themeColor="textSecondary">{t('dashboard.speed.limit')}</ThemedText>
        {limit === 'loading' ? <LoadingIndicator label={t('roadRisk.loading')} color={Colors.accent} />
          : <ThemedText type="bodyMedium">{limit === 'unknown' ? t('dashboard.speed.limitUnknown')
            : `${limitDisplay.formatted} ${limitDisplay.unit}`}</ThemedText>}
        {limit === 'current' && speedLimit.source !== 'unknown' ? <ThemedText type="small" themeColor="textSecondary">{t(`dashboard.speed.${speedLimit.source}`)}</ThemedText> : null}
      </View>
      {!location.fresh ? <ThemedText type="label" themeColor="textSecondary">{t(`dashboard.location.${location.status}`)}</ThemedText> : null}
    </Card>
  );
}

const makeStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  card: { gap: Space[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Space[2] },
  badge: { borderRadius: Radius.full, backgroundColor: Colors.accentSoft, paddingHorizontal: Space[3], paddingVertical: Space[1] },
  accent: { color: Colors.accent },
  limit: { alignItems: 'center', padding: Space[3], gap: Space[1], borderRadius: Radius.md, backgroundColor: Colors.backgroundElement },
});
