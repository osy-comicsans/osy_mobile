import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Palette, Priority, Radius, Space, Typography } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { useRoadRisk } from '@/features/road-risk/hooks/useRoadRisk';
import { useHomeLocation } from '../hooks/useHomeLocation';
import { homeRiskPresentation } from '../utils/homePresentation';

export function RiskCard() {
  const Colors = useTheme();
  const { t } = useTranslation();
  const risk = homeRiskPresentation(useHomeLocation(), useRoadRisk());
  return (
    <Card tone="ink" style={styles.card}>
      <ThemedText type="overline" style={styles.muted}>{t('dashboard.risk.title')}</ThemedText>
      {risk.status === 'loading' ? <ContentSkeleton lines={3} label={t('dashboard.risk.loading')} /> : null}
      {risk.status === 'permission' ? <ThemedText type="body" style={styles.muted}>{t('dashboard.location.permission')}</ThemedText> : null}
      {risk.status === 'unassessed' ? <ThemedText type="bodyMedium" style={styles.light}>{t('dashboard.risk.unknown')}</ThemedText> : null}
      {'score' in risk ? (
        <>
          <View style={styles.scoreRow} accessible
            accessibilityLabel={`${t(`dashboard.risk.${risk.level}`)}, ${formatNumber(getLanguage(), risk.score)} ${t('dashboard.risk.scale')}`}>
            <ThemedText style={[Typography.displayL, styles.light]}>{formatNumber(getLanguage(), risk.score)}</ThemedText>
            <View style={styles.scale}>
              <View style={[styles.level, { backgroundColor: Colors[Priority[risk.level]] }]}>
                <ThemedText type="label" style={styles.levelText}>{t(`dashboard.risk.${risk.level}`)}</ThemedText>
              </View>
              <ThemedText type="small" style={styles.muted}>{t('dashboard.risk.scale')}</ThemedText>
            </View>
          </View>
          <View style={styles.factors}>
            {risk.factors.map((factor) => <View key={factor} style={styles.factor}>
              <ThemedText type="label" style={styles.light}>{t(factor)}</ThemedText>
            </View>)}
          </View>
        </>
      ) : null}
      {'notes' in risk ? risk.notes.map((note) => (
        <ThemedText key={note} type="small" style={styles.muted}>{t(note)}</ThemedText>
      )) : null}
      {'score' in risk ? <ThemedText type="small" style={styles.muted}>{t('roadRisk.estimate')}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[3] },
  light: { color: Palette.white },
  muted: { color: Palette.purple[200] },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Space[4], flexWrap: 'wrap' },
  scale: { gap: Space[1], alignItems: 'flex-start' },
  level: { paddingHorizontal: Space[3], paddingVertical: 2, borderRadius: Radius.full },
  levelText: { color: Palette.neutral[800] },
  factors: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  factor: { paddingHorizontal: Space[3], paddingVertical: Space[1], borderRadius: Radius.full, backgroundColor: Palette.neutral[700] },
});
