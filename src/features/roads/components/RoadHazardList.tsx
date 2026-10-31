import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { distanceParts } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Palette, Radius, Space } from '@/common/lib/theme';
import type { hazardsAhead } from '@/features/road-risk/utils/roadHazards';
import { useSettings } from '@/features/settings/hooks/useSettings';

const ROUND_TO = 10;

// One chip per kind, showing the nearest, so three schools do not take three lines.
export function RoadHazardList({ hazards }: { hazards: ReturnType<typeof hazardsAhead> }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  if (hazards.length === 0) return null;
  const kinds = [...new Set(hazards.map(({ kind }) => kind))];
  return (
    <View accessibilityRole="list" accessibilityLabel={t('roadRisk.hazardsNearby')} style={styles.list}>
      {kinds.map((kind) => {
        const matching = hazards.filter((hazard) => hazard.kind === kind);
        const nearest = Math.min(...matching.map(({ distanceMeters }) => distanceMeters));
        const distance = distanceParts(getLanguage(), nearest, settings.units, ROUND_TO);
        return (
          <View key={kind} style={styles.chip}>
            <Icon name="warning" size={14} color={Colors.warning} />
            <ThemedText type="label" style={styles.text}>
              {t('roadRisk.hazardDistance', {
                name: t(`roadRisk.hazard.${kind}`),
                distance: t(`units.${distance.unit}`, { value: distance.value }),
              })}{matching.length > 1 ? ` +${matching.length - 1}` : ''}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Space[1], paddingHorizontal: Space[3], paddingVertical: Space[1], borderRadius: Radius.full, backgroundColor: Colors.warningSoft },
  text: { color: Palette.neutral[800] },
});
