import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { Colors, Radius, Space } from '@/common/lib/theme';
import { useDrivingMode } from '@/features/driving/hooks/useDrivingMode';
import { useMonitoringStatus } from '../hooks/useMonitoringStatus';

export function MonitoringCard() {
  const { t } = useTranslation();
  const status = useMonitoringStatus();
  const mode = useDrivingMode();
  return (
    <Card glass tone="accentSoft" style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: status === 'monitoring' ? Colors.success : status === 'paused' ? Colors.textSecondary : Colors.accent }]} />
        <ThemedText type="bodyMedium" accessibilityLiveRegion="polite">{t(`dashboard.monitoring.${status}`)}</ThemedText>
      </View>
      <ThemedText type="label" themeColor="textSecondary">{t(status === 'paused' ? 'dashboard.monitoring.pausedDetail'
        : status === 'limited' ? 'dashboard.monitoring.limitedDetail' : 'dashboard.monitoring.automaticDetail')}</ThemedText>
      {mode.error ? <ThemedText type="label" themeColor="error">{t('dashboard.monitoring.saveError')}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[2], padding: Space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space[2], flexWrap: 'wrap' },
  dot: { width: Space[2], height: Space[2], borderRadius: Radius.full },
});
