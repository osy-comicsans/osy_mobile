import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Radius, Space, Typography } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { useRiskAssessment } from '@/features/risk/hooks/useRiskAssessment';

export function RiskCard() {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const risk = useRiskAssessment();
  return (
    <Card glass tone="accentSoft" style={styles.card}>
      <View style={styles.row}>
        <ThemedText type="headingS">{t('dashboard.risk.title')}</ThemedText>
        {risk.source === 'placeholder' ? <View style={styles.badge}><ThemedText type="smallBold" style={styles.accent}>{t('dashboard.risk.preview')}</ThemedText></View> : null}
      </View>
      <View style={styles.scoreRow}>
        <ThemedText style={[Typography.displayL, styles.accent]}>{risk.score === null ? '—' : formatNumber(getLanguage(), risk.score)}</ThemedText>
        <View style={styles.scale}>
          <ThemedText type="bodyMedium">{t(`dashboard.risk.${risk.level}`)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{t('dashboard.risk.scale')}</ThemedText>
        </View>
      </View>
      {risk.source === 'placeholder' ? <ThemedText type="body" themeColor="textSecondary">{t('dashboard.risk.exampleDescription')}</ThemedText> : null}
      <ThemedText type="label">{t(risk.source === 'placeholder' ? 'dashboard.risk.factors' : 'dashboard.risk.liveFactors')}</ThemedText>
      {risk.factors.map((factor) => <View key={factor.id} style={styles.factor}>
        <View style={styles.dot} />
        <ThemedText type="label" style={styles.factorText}>{t(factor.labelKey, { defaultValue: t('dashboard.risk.unknown') })}</ThemedText>
      </View>)}
    </Card>
  );
}

const makeStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  card: { gap: Space[3] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Space[2] },
  badge: { borderWidth: 1, borderColor: Colors.borderStrong, paddingHorizontal: Space[3], paddingVertical: Space[1], borderRadius: Radius.full },
  accent: { color: Colors.accent },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Space[4], flexWrap: 'wrap' },
  scale: { gap: Space[1] },
  factor: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  factorText: { flex: 1 },
  dot: { width: Space[1], height: Space[1], borderRadius: Radius.full, backgroundColor: Colors.accent },
});
