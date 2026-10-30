import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/common/lib/theme';
import { usePlaygroundRegistry } from '../hooks/PlaygroundProvider';
import type { SensorId } from '../types/sensor.types';
import { LabButton } from './SensorCard';
import { SensorStatus } from './SensorStatus';
import { lab } from './playgroundTheme';

const sensors: { id: SensorId; label: string; code: string }[] = [
  { id: 'gps', label: 'GPS', code: 'LOC' },
  { id: 'accelerometer', label: 'Accelerometer', code: 'ACC' },
  { id: 'gyroscope', label: 'Gyroscope', code: 'GYR' },
  { id: 'motion', label: 'Device motion', code: 'IMU' },
  { id: 'pedometer', label: 'Pedometer', code: 'STEP' },
];

export function DashboardOverview() {
  const registry = usePlaygroundRegistry();
  const phases = useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
  const running = Object.values(phases).filter((phase) => phase === 'running').length;
  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        {sensors.map(({ id, label, code }) => (
          <View key={id} style={styles.tile}>
            <Text style={styles.code}>{code}</Text>
            <Text style={styles.name}>{label}</Text>
            <SensorStatus phase={phases[id]} />
          </View>
        ))}
      </View>
      <View style={styles.toolbar}>
        <Text style={styles.hint}>{running} tests running · all listeners stop on tab exit or background</Text>
        <LabButton label="Stop all tests" onPress={registry.stopAll} secondary />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 14 }, summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: 130, padding: 15, backgroundColor: lab.card, borderWidth: 1, borderColor: lab.border, borderRadius: Radius.md, gap: 11 },
  code: { color: lab.accent, fontFamily: lab.fontMedium, fontSize: 10, letterSpacing: 1.2 },
  name: { color: lab.text, fontFamily: lab.fontSemiBold, fontSize: 13 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  hint: { color: lab.muted, fontFamily: lab.font, fontSize: 13, lineHeight: 18, flexShrink: 1 },
});
