import { StyleSheet, Text, View } from 'react-native';

import { Slider } from '@/common/components/ui/slider';
import { LabButton } from './SensorCard';
import { lab } from './playgroundTheme';

export function SensitivitySlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Trigger threshold</Text>
        <Text style={styles.value}>{value.toFixed(1)} g</Text>
      </View>
      <Slider
        value={value}
        min={1.2}
        max={4}
        step={0.1}
        onChange={onChange}
        tone="dark"
        accessibilityLabel="Shake threshold"
        formatValue={(next) => `${next.toFixed(1)} g`}
      />
      <View style={styles.row}>
        <LabButton label="More sensitive −" onPress={() => onChange(value - 0.1)} secondary disabled={value <= 1.2} />
        <LabButton label="Less sensitive +" onPress={() => onChange(value + 0.1)} secondary disabled={value >= 4} />
      </View>
      <Text style={styles.hint}>Lower threshold = more sensitive. A sudden rise is required; cooldown is 1 second.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  label: { color: lab.muted, fontFamily: lab.font, fontSize: 13 },
  value: { color: lab.text, fontFamily: lab.mono, fontSize: 17 },
  hint: { color: lab.muted, fontFamily: lab.font, fontSize: 13, lineHeight: 18 },
});
