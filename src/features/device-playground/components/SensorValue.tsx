import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/common/lib/theme';
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
  value: { flexGrow: 1, flexBasis: '44%', minWidth: 130, padding: 12, gap: 6, borderRadius: Radius.sm, backgroundColor: lab.inset },
  wide: { flexBasis: '100%' },
  label: { color: lab.muted, fontFamily: lab.font, fontSize: 12, letterSpacing: 0.3 },
  number: { color: lab.text, fontFamily: lab.mono, fontSize: 16, fontVariant: ['tabular-nums'] },
  wideNumber: { fontSize: 12 },
  unit: { color: lab.muted, fontFamily: lab.font, fontSize: 11 },
});
