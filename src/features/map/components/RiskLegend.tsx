import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { Colors, Palette, Radius, Space } from '@/common/lib/theme';
import type { RoadHazardKind } from '@/features/road-risk/types/roadRisk.types';
import { HAZARD_COLORS, RISK_LEVEL_COLORS, RISK_LEVELS, type RiskMapStatus } from '@/features/road-risk/utils/riskOverlay';

interface RiskLegendProps {
  visible: boolean;
  onToggle: (visible: boolean) => void;
  status: RiskMapStatus | 'zoomIn';
}

export function RiskLegend({ visible, onToggle, status }: RiskLegendProps) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <ThemedText type="bodyMedium">{t('roadRisk.legendTitle')}</ThemedText>
        <Switch
          accessibilityLabel={t('roadRisk.show')}
          value={visible}
          onValueChange={onToggle}
          trackColor={{ true: Colors.accent, false: Palette.neutral[200] }}
        />
      </View>
      {visible && (
        <>
          <View style={styles.levels}>
            {RISK_LEVELS.map((level) => (
              <View key={level} style={styles.level}>
                <View style={[styles.swatch, { backgroundColor: RISK_LEVEL_COLORS[level] }]} />
                <ThemedText type="label" themeColor="textSecondary">{t(`roadRisk.level.${level}`)}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.hazards}>
            {(Object.keys(HAZARD_COLORS) as RoadHazardKind[]).map((kind) => (
              <View key={kind} style={styles.level}>
                <View style={[styles.dot, { backgroundColor: HAZARD_COLORS[kind] }]} />
                <ThemedText type="label" themeColor="textSecondary">{t(`roadRisk.hazard.${kind}`)}</ThemedText>
              </View>
            ))}
          </View>
          {status !== 'ready' && (
            <ThemedText type="label" themeColor={status === 'failed' ? 'errorText' : 'textSecondary'} accessibilityLiveRegion="polite">
              {t(`roadRisk.${status}`)}
            </ThemedText>
          )}
          <ThemedText type="label" themeColor="textSecondary">{t('roadRisk.credit')}</ThemedText>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[2], maxWidth: 260 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space[3] },
  levels: { gap: Space[1] },
  level: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  swatch: { width: 20, height: 5, borderRadius: Radius.full },
  hazards: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Space[3], rowGap: Space[1] },
  dot: { width: 10, height: 10, borderRadius: Radius.full },
});
