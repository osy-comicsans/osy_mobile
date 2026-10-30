import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Space } from '@/common/lib/theme';
import { useCurrentRoad } from '@/features/roads/hooks/useRoad';

import { useCurrentLocation, useCurrentSpeed, useDrivingState } from '../hooks/useLocation';

export function LiveLocationCard() {
  const { t } = useTranslation();
  const fix = useCurrentLocation();
  const speed = useCurrentSpeed();
  const drivingState = useDrivingState();
  const { road, stale } = useCurrentRoad();
  if (!fix) return null;

  const language = getLanguage();
  const speedText = speed === null ? '--' : formatNumber(language, Math.round(speed));
  const coordinate = (value: number) => formatNumber(language, value, {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
    useGrouping: false,
  });

  return (
    <Card style={styles.card}>
      <View accessible accessibilityLabel={speed === null ? t('units.speedUnknown') : t('units.speedSpoken', { value: speedText })}>
        <ThemedText type="display">{speedText}</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">{t('units.kmh')}</ThemedText>
      </View>
      <ThemedText type="bodyMedium">{t(`location.driving.${drivingState}`)}</ThemedText>
      {road && (
        <ThemedText type="label" themeColor={stale ? 'textTertiary' : 'textSecondary'} style={styles.road}>
          {[...road.refs, road.name].filter(Boolean).join(' · ')}
        </ThemedText>
      )}
      <ThemedText type="label" themeColor="textSecondary">
        {coordinate(fix.latitude)}, {coordinate(fix.longitude)}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', alignItems: 'center', gap: Space[2] },
  road: { textAlign: 'center' },
});
