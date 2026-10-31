import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { ContentSkeleton } from '@/common/components/ui/loading';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Priority, Radius, Space, Typography } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { useRoadRisk } from '@/features/road-risk/hooks/useRoadRisk';
import { useHomeLocation } from '../hooks/useHomeLocation';
import { homeRiskPresentation } from '../utils/homePresentation';

export function RiskCard() {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const risk = homeRiskPresentation(useHomeLocation(), useRoadRisk());
  return (
    <Card glass tone="accentSoft" style={styles.card}>
      <ThemedText type="headingS">{t('dashboard.risk.title')}</ThemedText>
      {risk.status === 'loading' ? <ContentSkeleton lines={3} label={t('dashboard.risk.loading')} /> : null}
      {risk.status === 'permission' ? <ThemedText type="body" themeColor="textSecondary">{t('dashboard.location.permission')}</ThemedText> : null}
      {risk.status === 'unassessed' ? <ThemedText type="bodyMedium">{t('dashboard.risk.unknown')}</ThemedText> : null}
      {'score' in risk ? (
        <>
          <View style={styles.scoreRow} accessible
            accessibilityLabel={`${t(`dashboard.risk.${risk.level}`)}, ${formatNumber(getLanguage(), risk.score)} ${t('dashboard.risk.scale')}`}>
            <ThemedText style={Typography.displayL} themeColor={risk.status === 'live' ? 'accent' : 'textSecondary'}>
              {formatNumber(getLanguage(), risk.score)}
            </ThemedText>
            <View style={styles.scale}>
              <View style={styles.level}>
                <View style={[styles.levelDot, { backgroundColor: Colors[Priority[risk.level]] }]} />
                <ThemedText type="bodyMedium">{t(`dashboard.risk.${risk.level}`)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">{t('dashboard.risk.scale')}</ThemedText>
            </View>
          </View>
          <ThemedText type="label">{t('dashboard.risk.factors')}</ThemedText>
          {risk.factors.map((factor) => <View key={factor} style={styles.factor}>
            <View style={styles.dot} />
            <ThemedText type="label" style={styles.factorText}>{t(factor)}</ThemedText>
          </View>)}
        </>
      ) : null}
      {'notes' in risk ? risk.notes.map((note) => (
        <ThemedText key={note} type="small" themeColor="textSecondary">{t(note)}</ThemedText>
      )) : null}
      {'score' in risk ? <ThemedText type="small" themeColor="textSecondary">{t('roadRisk.estimate')}</ThemedText> : null}
    </Card>
  );
}

const makeStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  card: { gap: Space[3] },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Space[4], flexWrap: 'wrap' },
  scale: { gap: Space[1] },
  level: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  levelDot: { width: Space[3], height: Space[3], borderRadius: Radius.full },
  factor: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  factorText: { flex: 1 },
  dot: { width: Space[1], height: Space[1], borderRadius: Radius.full, backgroundColor: Colors.accent },
});
