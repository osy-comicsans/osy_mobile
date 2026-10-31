import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { distanceParts, formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Radius, Shadow, Space } from '@/common/lib/theme';

interface RouteCardProps {
  route: { distanceMeters: number; durationSeconds: number } | null;
  failed: boolean;
  onEnd: () => void;
}

export function RouteCard({ route, failed, onEnd }: RouteCardProps) {
  const { t } = useTranslation();
  const language = getLanguage();

  let summary = t(failed ? 'nearby.routeFailed' : 'nearby.routeLoading');
  if (route) {
    const distance = distanceParts(language, route.distanceMeters);
    summary = t('nearby.routeSummary', {
      distance: t(`units.${distance.unit}`, { value: distance.value }),
      minutes: formatNumber(language, Math.max(1, Math.round(route.durationSeconds / 60))),
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <ThemedText type="headingS">{t('nearby.routeTitle')}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {summary}
        </ThemedText>
      </View>
      <Button label={t('nearby.endRoute')} variant="secondary" size="small" onPress={onEnd} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    padding: Space[4],
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    boxShadow: Shadow.md,
  },
  text: { flex: 1, gap: 2 },
});
