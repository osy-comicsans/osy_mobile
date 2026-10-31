import { router } from 'expo-router';
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

import { CountdownRing } from '../components/CountdownRing';
import { EscalationPanel } from '../components/EscalationPanel';
import { VoiceIndicator } from '../components/VoiceIndicator';
import { useCheckInService, useCheckInState } from '../hooks/useCheckIn';
import { useVoiceCheckIn } from '../hooks/useVoiceCheckIn';
import { CHECK_IN_ROUNDS_SECONDS } from '../utils/checkInService';

const SHARED_ITEMS = ['location', 'road', 'speed'] as const;
const CONFIRMED_DURATION = 1500;

// Falls back to replacing this screen when Home is not underneath it.
const goHome = () => router.dismissTo('/');

function useSecondsLeft(endsAt: number | null) {
  const [now, setNow] = useState(Date.now);

  const running = endsAt !== null;

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [running]);

  return endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function CheckInScreen() {
  const { t } = useTranslation();
  const service = useCheckInService();
  const { status, round, endsAt } = useCheckInState();
  const secondsLeft = useSecondsLeft(endsAt);
  const escalated = status === 'escalated';
  const confirmed = status === 'confirmed';
  const language = getLanguage();
  const voice = useVoiceCheckIn();

  // Covers a check-in opened from a notification or a link.
  useEffect(() => service.begin(), [service]);

  // The Android back button must not skip the question.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  // Leaves the green ring up long enough to be seen.
  useEffect(() => {
    if (!confirmed) return undefined;
    const timeout = setTimeout(goHome, CONFIRMED_DURATION);
    return () => clearTimeout(timeout);
  }, [confirmed]);

  const title = confirmed ? 'checkIn.confirmedTitle' : escalated ? 'checkIn.escalatedTitle' : 'checkIn.title';

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText
          type="title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={styles.centered}>
          {t(title)}
        </ThemedText>

        {escalated ? (
          <EscalationPanel />
        ) : (
          <CountdownRing
            key={round}
            total={CHECK_IN_ROUNDS_SECONDS[round]}
            remaining={secondsLeft}
            confirmed={confirmed}>
            <View
              accessible
              accessibilityLabel={confirmed
                ? t('checkIn.confirmedTitle')
                : t('checkIn.secondsLeft', { value: formatNumber(language, secondsLeft) })}
              style={styles.countdown}>
              {confirmed ? (
                <ThemedText type="display" themeColor="successText">✓</ThemedText>
              ) : (
                <>
                  <ThemedText type="display" themeColor="error" maxFontSizeMultiplier={1.5}>
                    {formatNumber(language, secondsLeft)}
                  </ThemedText>
                  <ThemedText type="label" themeColor="textSecondary" maxFontSizeMultiplier={1.5}>
                    {t('checkIn.seconds')}
                  </ThemedText>
                </>
              )}
            </View>
          </CountdownRing>
        )}

        {!escalated && !confirmed && round > 0 && (
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            {t('checkIn.stillWaiting')}
          </ThemedText>
        )}

        {!confirmed && <VoiceIndicator voice={voice} escalated={escalated} />}

        {confirmed && (
          <View style={styles.actions}>
            <Button label={t('checkIn.backHome')} size="large" onPress={goHome} style={styles.action} />
          </View>
        )}

        {!confirmed && (
          <View style={styles.actions}>
            <Button label={t('checkIn.ok')} size="large" onPress={service.confirmOk} style={styles.action} />
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
        )}

        {!escalated && !confirmed && (
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
  countdown: { alignItems: 'center' },
  actions: { gap: Space[3] },
  action: { height: 'auto', minHeight: 64, alignSelf: 'stretch' },
  shared: { gap: Space[2], padding: Space[4] },
});
