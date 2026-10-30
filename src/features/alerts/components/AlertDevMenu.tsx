import { randomUUID } from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Space } from '@/common/lib/theme';

import { useAlertService } from '../hooks/useAlerts';
import type { AlertType } from '../types/alert.types';
import { ALERT_TYPES } from '../utils/alertRules';

const BACKGROUND_DELAY_SECONDS = 5;

// Shown only in development builds. The delay leaves time to lock the phone.
export function AlertDevMenu() {
  const { t } = useTranslation();
  const service = useAlertService();

  const send = (type: AlertType, delaySeconds: number) => {
    const alert = { id: randomUUID(), type, roadName: 'RN 5', distanceMeters: 850 };
    const text = { title: t(`alerts.${type}.title`), body: t(`alerts.${type}.body`) };
    void service.sendTest(alert, text, delaySeconds);
  };

  return (
    <Card style={styles.card}>
      <ThemedText type="headingS" accessibilityRole="header">{t('alerts.dev.title')}</ThemedText>
      {ALERT_TYPES.map((type) => (
        <View key={type} style={styles.row}>
          <ThemedText type="bodyMedium" style={styles.label}>{t(`alerts.${type}.title`)}</ThemedText>
          <Button label={t('alerts.dev.now')} variant="secondary" size="small" onPress={() => send(type, 0)} />
          <Button
            label={t('alerts.dev.delayed', { seconds: BACKGROUND_DELAY_SECONDS })}
            variant="subtle"
            size="small"
            onPress={() => send(type, BACKGROUND_DELAY_SECONDS)}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Space[2] },
  label: { flex: 1, minWidth: 140 },
});
