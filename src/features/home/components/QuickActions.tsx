import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Space } from '@/common/lib/theme';
import { useDrivingMode, useDrivingModeService } from '@/features/driving/hooks/useDrivingMode';

export function QuickActions() {
  const { t } = useTranslation();
  const mode = useDrivingMode();
  const service = useDrivingModeService();
  return (
    <View style={styles.card}>
      <View style={styles.actions}>
        <Link href="/report-accident" asChild>
          <Button size="large" label={t('safety.reportTitle')} style={styles.button} />
        </Link>
        <Button size="large" variant="subtle" style={styles.button}
          label={t(mode.paused ? 'dashboard.actions.resume' : 'dashboard.actions.pause')}
          disabled={!mode.ready} loading={mode.saving}
          onPress={() => { void service.setPaused(!mode.paused); }} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">{t('dashboard.actions.hint')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Space[2] },
  actions: { gap: Space[2] },
  button: { alignSelf: 'stretch' },
});
