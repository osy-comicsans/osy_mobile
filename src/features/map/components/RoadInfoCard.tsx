import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Radius, Shadow, Space } from '@/common/lib/theme';
import { useCurrentSpeed } from '@/features/location/hooks/useLocation';
import { useCurrentRoad } from '@/features/roads/hooks/useRoad';

export function RoadInfoCard() {
  const { t } = useTranslation();
  const { road, stale } = useCurrentRoad();
  const speed = useCurrentSpeed();
  const speedText = speed === null ? '--' : formatNumber(getLanguage(), Math.round(speed));
  const spokenSpeed = speed === null ? t('units.speedUnknown') : t('units.speedSpoken', { value: speedText });

  return (
    <View accessible accessibilityLabel={`${road?.name ?? t('map.unknownRoad')}, ${spokenSpeed}`} style={styles.card}>
      <View style={styles.road}>
        {road && road.refs.length > 0 && (
          <View style={styles.plates}>
            {road.refs.map((ref) => (
              <View key={ref} style={styles.plate}>
                <ThemedText type="smallBold" style={styles.plateText}>{ref}</ThemedText>
              </View>
            ))}
          </View>
        )}
        <ThemedText
          type="bodyMedium"
          numberOfLines={2}
          themeColor={road && !stale ? 'textPrimary' : 'textTertiary'}>
          {road?.name ?? (road ? '' : t('map.unknownRoad'))}
        </ThemedText>
      </View>
      <View style={styles.speed}>
        <ThemedText type="heading">{speedText}</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">{t('units.kmh')}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    padding: Space[4],
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    boxShadow: Shadow.soft,
  },
  road: { flex: 1, gap: Space[1] },
  plates: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[1] },
  plate: {
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
  },
  plateText: { color: Colors.onAccent },
  speed: { alignItems: 'center', minWidth: 56 },
});
