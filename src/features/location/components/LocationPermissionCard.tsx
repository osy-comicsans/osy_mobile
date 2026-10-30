import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Space } from '@/common/lib/theme';

import { useLocationService, useLocationState } from '../hooks/useLocation';

const openSettings = () => { void Linking.openSettings(); };

function useMessage() {
  const { t } = useTranslation();
  const { status, location, canAskAgain, motion, error } = useLocationState();

  if (status === 'error') {
    return {
      title: t('location.permission.unavailableTitle'),
      body: error ? t(`location.errors.${error}`) : null,
      action: 'retry',
    } as const;
  }
  if (status === 'servicesDisabled') {
    return {
      title: t('location.permission.servicesOffTitle'),
      body: t('location.permission.servicesOffBody'),
      action: 'retry',
    } as const;
  }
  if (location === 'undetermined') {
    return {
      title: t('location.permission.requestTitle'),
      body: t('location.permission.requestBody'),
      action: 'request',
    } as const;
  }
  if (location === 'denied') {
    return {
      title: t('location.permission.deniedTitle'),
      body: t('location.permission.deniedBody'),
      action: canAskAgain ? 'request' : 'settings',
    } as const;
  }
  if (location === 'limited') {
    return {
      title: t('location.permission.limitedTitle'),
      body: t('location.permission.limitedBody'),
      action: 'settings',
    } as const;
  }
  if (motion === 'undetermined') {
    return {
      title: t('location.permission.motionRequestTitle'),
      body: t('location.permission.motionRequestBody'),
      action: 'request',
    } as const;
  }
  if (motion === 'denied') {
    return {
      title: t('location.permission.motionDeniedTitle'),
      body: t('location.permission.motionDeniedBody'),
      action: 'settings',
    } as const;
  }
  return null;
}

export function LocationPermissionCard() {
  const { t } = useTranslation();
  const service = useLocationService();
  const { requesting } = useLocationState();
  const message = useMessage();
  if (!message) return null;

  const canOpenSettings = message.action === 'settings' && Platform.OS !== 'web';

  return (
    <Card tone="accentSoft" style={styles.card}>
      <ThemedText type="headingS">{message.title}</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">{message.body}</ThemedText>
      {message.action === 'request' && (
        <Button label={t('common.allowAccess')} loading={requesting} onPress={() => void service.requestPermission()} />
      )}
      {message.action === 'retry' && (
        <Button label={t('common.tryAgain')} variant="secondary" onPress={() => void service.start()} />
      )}
      {canOpenSettings && <Button label={t('common.openSettings')} variant="secondary" onPress={openSettings} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Space[3] },
});
