import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/common/components/ui/ambient-background';
import { ThemedText } from '@/common/components/themed-text';
import { Colors, MaxContentWidth, Space } from '@/common/lib/theme';
import { GlassAppearanceProvider } from '@/common/providers/GlassAppearanceProvider';
import { AlertPermissionCard } from '@/features/alerts/components/AlertPermissionCard';
import { LocationPermissionCard } from '@/features/location/components/LocationPermissionCard';
import { WeatherWidget } from '@/features/weather/components/WeatherWidget';
import { MonitoringCard } from '../components/MonitoringCard';
import { SpeedCard } from '../components/SpeedCard';
import { CurrentRoadCard } from '../components/CurrentRoadCard';
import { RiskCard } from '../components/RiskCard';
import { QuickActions } from '../components/QuickActions';

export function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <GlassAppearanceProvider>
      <View style={styles.root}>
        <AmbientBackground />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Space[6], paddingBottom: insets.bottom + Space[8] }]}
          contentInsetAdjustmentBehavior="never">
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="overline" style={styles.accent}>{t('dashboard.eyebrow')}</ThemedText>
              <ThemedText type="display" accessibilityRole="header">{t('dashboard.title')}</ThemedText>
              <ThemedText type="body" themeColor="textSecondary">{t('dashboard.subtitle')}</ThemedText>
            </View>
            <MonitoringCard />
            <LocationPermissionCard glass />
            <View style={styles.grid}>
              <View style={styles.column}>
                <SpeedCard />
                <CurrentRoadCard />
              </View>
              <View style={styles.column}>
                <RiskCard />
                <WeatherWidget compact glass />
              </View>
            </View>
            <QuickActions />
            <AlertPermissionCard glass />
          </View>
        </ScrollView>
      </View>
    </GlassAppearanceProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { alignItems: 'center', paddingHorizontal: Space[4] },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Space[4] },
  header: { gap: Space[2], paddingHorizontal: Space[2], paddingBottom: Space[2] },
  accent: { color: Colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] },
  column: { flexBasis: 300, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: Space[4] },
});
