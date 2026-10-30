import { StyleSheet, Text, View } from 'react-native';

import type { SensorPhase } from '../types/sensor.types';
import { lab } from './playgroundTheme';

const labels: Record<SensorPhase, string> = {
  stopped: 'Stopped', starting: 'Starting', running: 'Running', denied: 'Permission denied', unavailable: 'Unavailable', error: 'Error',
};
export function SensorStatus({ phase }: { phase: SensorPhase }) {
  const color = phase === 'running' ? lab.green : phase === 'error' || phase === 'denied' ? lab.red : lab.stopped;
  return (
    <View style={styles.status} accessibilityLabel={`Status: ${labels[phase]}`} accessibilityLiveRegion="polite">
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{labels[phase]}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: lab.fontMedium, fontSize: 11 },
});
