import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Radius, Space, Typography } from '@/common/lib/theme';
import { useRoadRules } from '@/features/roads/hooks/useRoadRules';
import { useHomeLocation } from '../hooks/useHomeLocation';

export function SpeedCard() {
  const { t } = useTranslation();
  const location = useHomeLocation();
  const { speedLimit } = useRoadRules();
  const language = getLanguage();
  const speed = location.speedKmh === null ? '—' : formatNumber(language, Math.round(location.speedKmh));
  return (
    <Card glass style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="overline" themeColor="textSecondary">{t('dashboard.speed.title')}</ThemedText>
        <View style={styles.badge}>
          <ThemedText type="label" style={styles.accent}>{location.movement ? t(`location.driving.${location.movement}`) : t('dashboard.speed.waiting')}</ThemedText>
        </View>
      </View>
      {location.loading ? <ContentSkeleton lines={2} label={t('dashboard.speed.loading')} /> : (
        <View style={styles.reading} accessible accessibilityLabel={location.speedKmh === null
          ? t('units.speedUnknown') : t('units.speedSpoken', { value: speed })}>
          <ThemedText style={Typography.displayXL}>{speed}</ThemedText>
          <ThemedText type="bodyMedium" themeColor="textSecondary">{t('dashboard.speed.unit')}</ThemedText>
        </View>
      )}
      <View style={styles.limit}>
        <ThemedText type="label" themeColor="textSecondary">{t('dashboard.speed.limit')}</ThemedText>
        <ThemedText type="bodyMedium">{speedLimit.valueKmh === null ? t('dashboard.speed.limitUnknown')
          : t('units.speed', { value: formatNumber(language, speedLimit.valueKmh) })}</ThemedText>
        {speedLimit.source !== 'unknown' ? <ThemedText type="small" themeColor="textSecondary">{t(`dashboard.speed.${speedLimit.source}`)}</ThemedText> : null}
      </View>
      {!location.fresh ? <ThemedText type="label" themeColor="textSecondary">{t(`dashboard.location.${location.status}`)}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Space[2] },
  badge: { borderRadius: Radius.full, backgroundColor: Colors.accentSoft, paddingHorizontal: Space[3], paddingVertical: Space[1] },
  accent: { color: Colors.accent },
  reading: { alignItems: 'center', justifyContent: 'center', paddingVertical: Space[4], gap: Space[1] },
  limit: { alignItems: 'center', padding: Space[3], gap: Space[1], borderRadius: Radius.md, backgroundColor: Colors.backgroundElement },
});
