import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Space } from '@/common/lib/theme';

import { useCheckInService, useCheckInState } from '../hooks/useCheckIn';
import { useDismissModal } from '../hooks/useDismissModal';

const SHARED_ITEMS = ['location', 'road', 'speed'] as const;

function useSecondsLeft(endsAt: number | null) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  return endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function CheckInScreen() {
  const { t } = useTranslation();
  const dismiss = useDismissModal();
  const service = useCheckInService();
  const { status, round, endsAt } = useCheckInState();
  const secondsLeft = useSecondsLeft(endsAt);
  const escalated = status === 'escalated';

  // Covers a check-in opened from a notification or a link.
  useEffect(() => service.begin(), [service]);

  // The Android back button must not skip the question.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const confirmOk = () => {
    service.confirmOk();
    dismiss();
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" accessibilityRole="header" style={styles.centered}>
          {t(escalated ? 'checkIn.escalatedTitle' : 'checkIn.title')}
        </ThemedText>

        {escalated ? (
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            {t('checkIn.escalatedBody')}
          </ThemedText>
        ) : (
          <View
            accessible
            accessibilityLabel={t('checkIn.secondsLeft', { value: formatNumber(getLanguage(), secondsLeft) })}
            style={styles.countdown}>
            <ThemedText type="display" themeColor="error">{formatNumber(getLanguage(), secondsLeft)}</ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
              {t(round === 0 ? 'checkIn.waiting' : 'checkIn.stillWaiting')}
            </ThemedText>
          </View>
        )}

        <View style={styles.actions}>
          <Button label={t('checkIn.ok')} size="large" onPress={confirmOk} style={styles.action} />
          {!escalated && (
            <Button
              label={t('checkIn.help')}
              size="large"
              variant="destructive"
              onPress={service.needHelp}
              style={styles.action}
            />
          )}
        </View>

        {!escalated && (
          <Card tone="muted" style={styles.shared}>
            <ThemedText type="bodyMedium">{t('checkIn.sharedTitle')}</ThemedText>
            {SHARED_ITEMS.map((item) => (
              <ThemedText key={item} type="body" themeColor="textSecondary">
                {t(`checkIn.shared.${item}`)}
              </ThemedText>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, justifyContent: 'center', gap: Space[6], padding: Space[6] },
  centered: { textAlign: 'center' },
  countdown: { alignItems: 'center', gap: Space[2] },
  actions: { gap: Space[3] },
  action: { height: 'auto', minHeight: 64, alignSelf: 'stretch' },
  shared: { gap: Space[2], padding: Space[4] },
});
