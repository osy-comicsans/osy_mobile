import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { lab } from './playgroundTheme';

export function SensorValue({ label, value, unit, wide }: { label: string; value: ReactNode; unit?: string; wide?: boolean }) {
  return (
    <View style={[styles.value, wide && styles.wide]}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={[styles.number, wide && styles.wideNumber]}>
        {value}{unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  value: { flexGrow: 1, flexBasis: '44%', minWidth: 130, padding: 12, gap: 6, borderRadius: 9, backgroundColor: lab.inset },
  wide: { flexBasis: '100%' },
  label: { color: lab.muted, fontSize: 11, letterSpacing: 0.3 },
  number: { color: lab.text, fontFamily: lab.mono, fontSize: 16, fontVariant: ['tabular-nums'] },
  wideNumber: { fontSize: 12 },
  unit: { color: lab.muted, fontSize: 11 },
});
