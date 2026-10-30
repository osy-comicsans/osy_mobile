import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/common/lib/theme';
import { clamp, finite, formatNumber } from '../utils/sensor.utils';
import { lab } from './playgroundTheme';

export function RotationDial({ value, label, compass }: { value?: number | null; label: string; compass?: boolean }) {
  const valid = finite(value) && (!compass || value >= 0);
  const angle = valid ? (compass ? value % 360 : clamp(value, -160, 160)) : 0;
  return (
    <View style={styles.dialRow}>
      <View style={styles.dial}>
        <Text style={styles.north}>{compass ? 'N' : '0'}</Text>
        <Text style={styles.west}>{compass ? 'W' : '−'}</Text>
        <Text style={styles.east}>{compass ? 'E' : '+'}</Text>
        {valid ? (
          <View style={[styles.needleContainer, { transform: [{ rotate: `${angle}deg` }] }]}>
            <View style={styles.needle} />
          </View>
        ) : <Text style={styles.unknown}>—</Text>}
        <View style={styles.center} />
      </View>
      <View style={styles.caption}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{valid ? `${formatNumber(value, 1)}°${compass ? '' : '/s'}` : 'Unavailable'}</Text>
        {!compass && <Text style={styles.hint}>Rate dial; not an orientation estimate.</Text>}
      </View>
    </View>
  );
}

export function OrientationIndicator({ rotation }: { rotation?: { alpha: number; beta: number; gamma: number } | null }) {
  const valid = rotation && finite(rotation.alpha) && finite(rotation.beta) && finite(rotation.gamma);
  return (
    <View style={styles.orientation}>
      {valid ? (
        <View style={[styles.phone, { transform: [
          { perspective: 500 }, { rotateZ: `${rotation.alpha}rad` },
          { rotateX: `${rotation.beta}rad` }, { rotateY: `${rotation.gamma}rad` },
        ] }]}>
          <View style={styles.notch} />
          <Text style={styles.phoneText}>↑{ '\n' }TOP</Text>
        </View>
      ) : <Text style={styles.hint}>Waiting for rotation data</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  dialRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  dial: { height: 100, width: 100, borderRadius: 50, backgroundColor: lab.inset, borderColor: lab.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  north: { position: 'absolute', top: 7, color: lab.muted, fontFamily: lab.mono, fontSize: 9 },
  west: { position: 'absolute', left: 8, color: lab.muted, fontFamily: lab.mono, fontSize: 9 },
  east: { position: 'absolute', right: 8, color: lab.muted, fontFamily: lab.mono, fontSize: 9 },
  needleContainer: { position: 'absolute', width: 4, height: 60, alignItems: 'center', justifyContent: 'flex-start' },
  needle: { width: 3, height: 30, backgroundColor: lab.accent, borderRadius: 2 },
  center: { width: 7, height: 7, borderRadius: 4, backgroundColor: lab.accent },
  unknown: { color: lab.muted, position: 'absolute', bottom: 15 },
  caption: { flex: 1, gap: 7 }, label: { color: lab.muted, fontFamily: lab.font, fontSize: 12 },
  value: { color: lab.text, fontFamily: lab.mono, fontSize: 17 }, hint: { color: lab.muted, fontFamily: lab.font, fontSize: 11, lineHeight: 16 },
  orientation: { height: 160, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: Radius.md, backgroundColor: lab.inset },
  phone: { width: 70, height: 120, borderRadius: 14, borderWidth: 2, borderColor: lab.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: lab.inset },
  notch: { position: 'absolute', top: 5, width: 24, height: 4, borderRadius: 2, backgroundColor: lab.accent },
  phoneText: { color: lab.accent, fontFamily: lab.mono, fontSize: 14, textAlign: 'center', lineHeight: 23 },
});
