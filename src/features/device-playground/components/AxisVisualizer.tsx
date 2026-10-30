import { StyleSheet, Text, View } from 'react-native';

import { clamp, finite, formatNumber } from '../utils/sensor.utils';
import { lab } from './playgroundTheme';

type Axes = { x?: number | null; y?: number | null; z?: number | null };
export function AxisVisualizer({ vector, range, unit, labels = ['X', 'Y', 'Z'] }: {
  vector?: Axes | null; range: number; unit: string; labels?: string[];
}) {
  return (
    <View style={styles.axes}>
      {(['x', 'y', 'z'] as const).map((axis, index) => {
        const value = vector?.[axis];
        const ratio = finite(value) ? clamp(value / range, -1, 1) : 0;
        const color = [lab.x, lab.y, lab.z][index];
        return (
          <View key={axis} style={styles.row}>
            <Text style={[styles.axis, { color }]}>{labels[index]}</Text>
            <View style={styles.track}>
              <View style={styles.center} />
              {finite(value) && <View style={[styles.fill, { left: `${50 + Math.min(0, ratio) * 50}%`, width: `${Math.abs(ratio) * 50}%`, backgroundColor: color }]} />}
            </View>
            <Text style={styles.number}>{formatNumber(value)} {unit}</Text>
          </View>
        );
      })}
      <Text style={styles.scale}>Signed axis display · ±{formatNumber(range, 1)} {unit}</Text>
    </View>
  );
}

export function MagnitudeBar({ value, max = 4, threshold, unit = 'g', label = 'Magnitude' }: {
  value?: number | null; max?: number; threshold?: number; unit?: string; label?: string;
}) {
  return (
    <View style={styles.axes}>
      <View style={styles.row}>
        <Text style={styles.scale}>{label}</Text>
        <Text style={styles.magnitude}>{formatNumber(value, 2)} {unit}</Text>
      </View>
      <View style={styles.meter}>
        {finite(value) && <View style={[styles.fill, { left: 0, width: `${clamp(value / max, 0, 1) * 100}%`, backgroundColor: lab.accent }]} />}
        {threshold !== undefined && <View style={[styles.threshold, { left: `${clamp(threshold / max, 0, 1) * 100}%` }]} />}
      </View>
      <Text style={styles.scale}>Display range 0–{max} {unit}{threshold !== undefined ? ' · amber line = trigger' : ''}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  axes: { gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  axis: { fontFamily: lab.mono, fontSize: 12, width: 14 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: lab.inset, overflow: 'hidden' },
  center: { position: 'absolute', left: '50%', width: 1, height: '100%', backgroundColor: lab.border },
  fill: { position: 'absolute', height: '100%', borderRadius: 4 },
  number: { color: lab.text, fontFamily: lab.mono, fontSize: 10, width: 90, textAlign: 'right', fontVariant: ['tabular-nums'] },
  scale: { color: lab.muted, fontSize: 10, lineHeight: 16 },
  magnitude: { color: lab.text, fontFamily: lab.mono, fontSize: 17 },
  meter: { height: 9, backgroundColor: lab.inset, borderRadius: 5 },
  threshold: { position: 'absolute', width: 2, height: 15, top: -3, backgroundColor: lab.z },
});
