import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHero } from '@/common/components/ui/screen-hero';
import { MaxContentWidth, Space } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { AlertPermissionCard } from '@/features/alerts/components/AlertPermissionCard';
import { LocationPermissionCard } from '@/features/location/components/LocationPermissionCard';
import { WeatherWidget } from '@/features/weather/components/WeatherWidget';
import { CurrentRoadCard } from '../components/CurrentRoadCard';
import { RiskCard } from '../components/RiskCard';
import { MonitoringPill, SpeedHero } from '../components/SpeedHero';
import { QuickActions } from '../components/QuickActions';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Space[8] }} contentInsetAdjustmentBehavior="never">
          <ScreenHero>
            <MonitoringPill />
            <SpeedHero />
          </ScreenHero>
          <View style={styles.scroll}>
          <View style={styles.content}>
            <LocationPermissionCard />
            <View style={styles.grid}>
              <View style={styles.column}>
                              </View>
              <View style={styles.column}>
                <RiskCard />
                <CurrentRoadCard />
                <WeatherWidget compact />
              </View>
            </View>
            <QuickActions />
            <AlertPermissionCard />
          </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: 'center', padding: Space[4] },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Space[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[4] },
  column: { flexBasis: 300, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: Space[4] },
});
