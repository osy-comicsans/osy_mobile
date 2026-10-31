import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Colors, Radius, Shadow, Space } from '@/common/lib/theme';

import { useAlertService, useAlertState } from '../hooks/useAlerts';
import { ALERT_RULES } from '../utils/alertRules';
import { useTheme } from '@/common/hooks/use-theme';

const severityStyles = {
  critical: { backgroundColor: Colors.errorSoft, borderColor: Colors.error },
  warning: { backgroundColor: Colors.warningSoft, borderColor: Colors.warning },
  info: { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
} as const;

export function AlertBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  const service = useAlertService();
  const { banner } = useAlertState();
  const { top } = useSafeAreaInsets();
  if (!banner) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { top: top + Space[2] }]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.banner, severityStyles[ALERT_RULES[banner.type].severity], theme.background !== Colors.background && { backgroundColor: theme.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t('alerts.view')}
          onPress={() => service.open(banner)}
          style={styles.text}>
          <ThemedText type="headingS">{t(`alerts.${banner.type}.title`)}</ThemedText>
          <ThemedText type="label" themeColor="textSecondary">{banner.detail ?? t(`alerts.${banner.type}.body`)}</ThemedText>
        </Pressable>
        <Button label={t('common.dismiss')} variant="text" size="small" onPress={service.dismissBanner} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', start: Space[4], end: Space[4] },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    padding: Space[3],
    borderWidth: 1,
    borderRadius: Radius.lg,
    boxShadow: Shadow.md,
  },
  text: { flex: 1, gap: Space[1] },
});
