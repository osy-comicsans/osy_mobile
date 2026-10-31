import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { Icon } from '@/common/components/ui/icon';
import { Colors, Radius, Space } from '@/common/lib/theme';
import type { SegmentRisk } from '@/features/road-risk/types/roadRisk.types';
import { RISK_LEVEL_COLORS } from '@/features/road-risk/utils/riskOverlay';

interface RiskRoadCardProps {
  risk: SegmentRisk;
  weatherKnown: boolean;
  onClose: () => void;
}

export function RiskRoadCard({ risk, weatherKnown, onClose }: RiskRoadCardProps) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.title}>
          <View style={[styles.swatch, { backgroundColor: RISK_LEVEL_COLORS[risk.level] }]} />
          <ThemedText type="bodyMedium">{t(`roadRisk.level.${risk.level}`)}</ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('roadRisk.close')} hitSlop={12} onPress={onClose}>
          <Icon name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>
      {risk.factors.map(({ id }) => (
        <ThemedText key={id} type="label">{t(`roadRisk.factor.${id}`)}</ThemedText>
      ))}
      {!weatherKnown && <ThemedText type="label" themeColor="textSecondary">{t('roadRisk.noWeather')}</ThemedText>}
      <ThemedText type="label" themeColor="textSecondary">{t('roadRisk.estimate')}</ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[1] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  swatch: { width: 12, height: 12, borderRadius: Radius.full },
});
