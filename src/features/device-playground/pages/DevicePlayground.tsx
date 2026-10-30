import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccelerometerSection } from '../components/AccelerometerSection';
import { DashboardOverview } from '../components/DashboardOverview';
import { DeviceMotionSection } from '../components/DeviceMotionSection';
import { GyroscopeSection } from '../components/GyroscopeSection';
import { LocationSection } from '../components/LocationSection';
import { PedometerSection } from '../components/PedometerSection';
import { ShakeSection } from '../components/ShakeSection';
import { lab } from '../components/playgroundTheme';
import { PlaygroundProvider } from '../hooks/PlaygroundProvider';

export default function DevicePlayground() {
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const panel = width >= 900 ? styles.half : styles.full;
  return (
    <PlaygroundProvider>
      {focused && <StatusBar style="light" />}
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.dashboard}>
            <View style={styles.header}>
              <View style={styles.eyebrow}>
                <View style={styles.dot} />
                <Text style={styles.kicker}>DEVICE LAB / TEMPORARY PLAYGROUND</Text>
              </View>
              <Text style={styles.title} accessibilityRole="header">Device playground</Text>
              <Text style={styles.subtitle}>Inspect the hardware. Follow every signal.</Text>
              <Text style={styles.description}>Six independent experiments. Start a test to see actual device readings. Everything stays in memory; nothing is saved or uploaded.</Text>
              <View style={styles.badges}>
                {['FOREGROUND ONLY', 'REAL HARDWARE', 'UI ≤ 8 Hz'].map((badge) => <Text key={badge} style={styles.badge}>{badge}</Text>)}
              </View>
            </View>
            <DashboardOverview />
            <View style={styles.divider} />
            <View style={styles.grid}>
              <View style={panel}><LocationSection /></View>
              <View style={panel}><AccelerometerSection /></View>
              <View style={panel}><GyroscopeSection /></View>
              <View style={panel}><DeviceMotionSection /></View>
              <View style={panel}><ShakeSection /></View>
              <View style={panel}><PedometerSection /></View>
            </View>
            <Text style={styles.footer}>EXPERIMENTAL / Physical-device validation recommended. Motion tests are native-only; GPS also uses the browser’s location provider when available.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PlaygroundProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lab.background },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 160 : 24, paddingBottom: 140, alignItems: 'center' },
  dashboard: { width: '100%', maxWidth: 1240, gap: 24 },
  header: { gap: 14, paddingVertical: 8 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: lab.accent },
  kicker: { color: lab.accent, fontFamily: lab.fontMedium, fontSize: 11, letterSpacing: 0.88, flexShrink: 1 },
  title: { color: lab.text, fontFamily: lab.fontBold, fontSize: 34, lineHeight: 42, letterSpacing: -0.68 },
  subtitle: { color: lab.text, fontFamily: lab.fontMedium, fontSize: 20, lineHeight: 28 },
  description: { color: lab.muted, fontFamily: lab.font, fontSize: 13, lineHeight: 20, maxWidth: 630 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { color: lab.muted, borderWidth: 1, borderColor: lab.border, borderRadius: 999, fontFamily: lab.fontMedium, fontSize: 10, paddingHorizontal: 10, paddingVertical: 6, letterSpacing: 0.6 },
  divider: { height: 1, backgroundColor: lab.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'space-between', gap: 16 },
  half: { width: '48%', flexGrow: 1 }, full: { width: '100%' },
  footer: { color: lab.muted, fontFamily: lab.fontMedium, fontSize: 11, lineHeight: 18 },
});
