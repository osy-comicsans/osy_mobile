import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Colors, Radius, Shadow, Space } from '@/common/lib/theme';
import { useCurrentSpeed } from '@/features/location/hooks/useLocation';
import { RoadHazardList } from '@/features/roads/components/RoadHazardList';
import { useCurrentRoad } from '@/features/roads/hooks/useRoad';
import { useSpeedDisplay } from '@/features/settings/hooks/useSpeedDisplay';
import { useTheme } from '@/common/hooks/use-theme';

export function RoadInfoCard() {
  const { t } = useTranslation();
  const { road, stale } = useCurrentRoad();
  const speed = useCurrentSpeed();
  const display = useSpeedDisplay(speed);
  const theme = useTheme();
  const speedText = display.formatted;
  const spokenSpeed = display.spoken;

  const limitText = speedLimit.valueKmh === null ? '' : `, ${t('dashboard.speed.limit')} ${t('units.speed', { value: speedLimit.valueKmh })}`;

  return (
    <View accessible accessibilityLabel={`${road?.name ?? t('map.unknownRoad')}, ${spokenSpeed}`} style={[styles.card, { backgroundColor: theme.surface }]}>
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
      {speedLimit.valueKmh !== null && (
        <View style={styles.limit}>
          <ThemedText type="smallBold">{formatNumber(getLanguage(), speedLimit.valueKmh)}</ThemedText>
        </View>
      )}
      <View style={styles.speed}>
        <ThemedText type="heading">{speedText}</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">{display.unit}</ThemedText>
      </View>
      </View>
      <RoadHazardList hazards={hazards} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Space[2],
    padding: Space[4],
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    boxShadow: Shadow.soft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  limit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 4,
    borderColor: Colors.error,
    backgroundColor: Colors.surface,
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
