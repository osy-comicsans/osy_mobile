import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Colors, Palette, Radius, Space } from '@/common/lib/theme';
import { useDrivingMode } from '@/features/driving/hooks/useDrivingMode';
import { useRoadRisk } from '@/features/road-risk/hooks/useRoadRisk';
import { useRoadRules } from '@/features/roads/hooks/useRoadRules';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useSpeedDisplay } from '@/features/settings/hooks/useSpeedDisplay';

import { Speedometer } from './Speedometer';
import { useHomeLocation } from '../hooks/useHomeLocation';
import { useMonitoringStatus } from '../hooks/useMonitoringStatus';
import { homeSpeedLimitStatus } from '../utils/homePresentation';

// The hero reading: the live dial, with the road's limit beneath it once known.
export function SpeedHero() {
  const { t } = useTranslation();
  const location = useHomeLocation();
  const { loading } = useRoadRisk();
  const { speedLimit } = useRoadRules();
  const limit = homeSpeedLimitStatus(location, loading, speedLimit.valueKmh);
  const limitDisplay = useSpeedDisplay(speedLimit.valueKmh);
  return (
    <View style={styles.root}>
      <Speedometer speedKmh={location.speedKmh} limitKmh={limit === 'current' ? speedLimit.valueKmh : null} />
      {limit === 'current' ? <ThemedText type="label" style={styles.limit}>
        {`${t('dashboard.speed.limit')} · ${limitDisplay.formatted} ${limitDisplay.unit}`}
      </ThemedText> : null}
    </View>
  );
}

export function MonitoringPill() {
  const { t } = useTranslation();
  const status = useMonitoringStatus();
  const mode = useDrivingMode();
  const { settings } = useSettings();
  const location = useHomeLocation();
  const on = settings.crashDetection && status === 'monitoring';
  return (
    <View style={styles.status}>
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: on ? Colors.success : settings.crashDetection ? Palette.purple[200] : Colors.warning }]} />
        <ThemedText type="label" style={styles.pillText} accessibilityLiveRegion="polite">
          {t(settings.crashDetection ? `dashboard.monitoring.${status}` : 'preferences.detectionDisabled')}
        </ThemedText>
      </View>
      {!settings.crashDetection ? <ThemedText type="small" style={styles.note}>{t('preferences.detectionDisabledHint')}</ThemedText> : null}
      {status === 'paused' || status === 'limited' ? <ThemedText type="small" style={styles.note}>{t(`dashboard.monitoring.${status}Detail`)}</ThemedText> : null}
      {mode.error ? <ThemedText type="small" style={styles.note}>{t('dashboard.monitoring.saveError')}</ThemedText> : null}
      {!location.fresh ? <ThemedText type="small" style={styles.note}>{t(`dashboard.location.${location.status}`)}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: Space[2] },
  limit: { color: Palette.purple[100], textAlign: 'center' },
  status: { gap: Space[1], alignItems: 'flex-start' },
  note: { color: Palette.purple[100] },
  pill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: Space[2], paddingHorizontal: Space[3],
    paddingVertical: Space[1], borderRadius: Radius.full, backgroundColor: Palette.purple[600],
  },
  dot: { width: Space[2], height: Space[2], borderRadius: Radius.full },
  pillText: { color: Colors.onAccent },
});
