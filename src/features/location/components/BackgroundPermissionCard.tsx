import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Space } from '@/common/lib/theme';

import { useLocationService, useLocationState } from '../hooks/useLocation';

// Explains why before the system prompt, which app store review expects.
export function BackgroundPermissionCard() {
  const { t } = useTranslation();
  const service = useLocationService();
  const { location, background, requesting } = useLocationState();
  const hasForeground = location === 'granted' || location === 'limited';
  if (!hasForeground || background === 'granted' || background === 'unavailable') return null;

  return (
    <Card tone="accentSoft" style={styles.card}>
      <ThemedText type="headingS">{t('location.background.title')}</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">{t('location.background.body')}</ThemedText>
      {background === 'denied' ? (
        <Button label={t('common.openSettings')} variant="secondary" onPress={() => void Linking.openSettings()} />
      ) : (
        <Button label={t('common.allowAccess')} loading={requesting} onPress={() => void service.requestBackgroundPermission()} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Space[3] },
});
