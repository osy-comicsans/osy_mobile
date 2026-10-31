import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Space } from '@/common/lib/theme';

import { useAlertService, useAlertState } from '../hooks/useAlerts';
import { alertDriver } from '../native/alertDriver';

export function AlertPermissionCard({ glass = false }: { glass?: boolean }) {
  const { t } = useTranslation();
  const service = useAlertService();
  const { permission, canAskAgain, requesting } = useAlertState();
  if (!alertDriver.supported || permission === 'granted') return null;

  const denied = permission === 'denied';

  return (
    <Card glass={glass} tone="accentSoft" style={styles.card}>
      <ThemedText type="headingS">{t(denied ? 'alerts.permission.deniedTitle' : 'alerts.permission.requestTitle')}</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        {t(denied ? 'alerts.permission.deniedBody' : 'alerts.permission.requestBody')}
      </ThemedText>
      {canAskAgain ? (
        <Button label={t('common.allowAccess')} loading={requesting} onPress={() => void service.requestPermission()} />
      ) : (
        <Button label={t('common.openSettings')} variant="secondary" onPress={() => void Linking.openSettings()} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Space[3] },
});
