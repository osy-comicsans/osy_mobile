import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { clamp } from '../utils/sensor.utils';
import { LabButton } from './SensorCard';
import { lab } from './playgroundTheme';

// A small accessible responder slider keeps this disposable playground free
// of an extra native dependency. The buttons also support keyboard users.
export function SensitivitySlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(0);
  const progress = (value - 1.2) / 2.8;
  const move = (event: GestureResponderEvent) => {
    if (width > 0) onChange(1.2 + clamp(event.nativeEvent.locationX / width, 0, 1) * 2.8);
  };
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Trigger threshold</Text>
        <Text style={styles.value}>{value.toFixed(1)} g</Text>
      </View>
      <View
        accessible accessibilityRole="adjustable" accessibilityLabel="Shake threshold"
        accessibilityValue={{ min: 1.2, max: 4, now: value, text: `${value.toFixed(1)} g` }}
        accessibilityActions={[{ name: 'increment', label: 'Raise threshold' }, { name: 'decrement', label: 'Lower threshold' }]}
        onAccessibilityAction={({ nativeEvent }) => onChange(value + (nativeEvent.actionName === 'increment' ? 0.1 : -0.1))}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={move} onResponderMove={move} onResponderTerminationRequest={() => false}
        style={styles.touchTrack}>
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
        </View>
      </View>
      <View style={styles.row}>
        <LabButton label="More sensitive −" onPress={() => onChange(value - 0.1)} secondary disabled={value <= 1.2} />
        <LabButton label="Less sensitive +" onPress={() => onChange(value + 0.1)} secondary disabled={value >= 4} />
      </View>
      <Text style={styles.hint}>Lower threshold = more sensitive. A sudden rise is required; cooldown is 1 second.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  label: { color: lab.muted, fontSize: 12 }, value: { color: lab.text, fontFamily: lab.mono, fontSize: 17 },
  touchTrack: { height: 44, justifyContent: 'center', paddingHorizontal: 10 },
  track: { height: 6, borderRadius: 3, backgroundColor: lab.border },
  fill: { height: 6, borderRadius: 3, backgroundColor: lab.accent },
  thumb: { position: 'absolute', width: 20, height: 20, marginLeft: -10, top: -7, borderRadius: 10, backgroundColor: lab.text, borderWidth: 3, borderColor: lab.accent },
  hint: { color: lab.muted, fontSize: 11, lineHeight: 18 },
});
