import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { distanceParts } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Space } from '@/common/lib/theme';
import type { hazardsAhead } from '@/features/road-risk/utils/roadHazards';
import { useSettings } from '@/features/settings/hooks/useSettings';

const ROUND_TO = 10;

export function RoadHazardList({ hazards }: { hazards: ReturnType<typeof hazardsAhead> }) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  if (hazards.length === 0) return null;
  return (
    <View accessibilityRole="list" accessibilityLabel={t('roadRisk.hazardsNearby')} style={styles.list}>
      {hazards.map(({ id, kind, distanceMeters }) => {
        const distance = distanceParts(getLanguage(), distanceMeters, settings.units, ROUND_TO);
        return (
          <View key={id} style={styles.row}>
            <Icon name="warning" size={16} color={Colors.warning} />
            <ThemedText type="label">
              {t('roadRisk.hazardDistance', {
                name: t(`roadRisk.hazard.${kind}`),
                distance: t(`units.${distance.unit}`, { value: distance.value }),
              })}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
});
