import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';

interface ChoicePillsProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}

// DESIGN.md §14.2 filter pills, with room for a thumb.
export function ChoicePills<T extends string>({ label, options, selected, onSelect }: ChoicePillsProps<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [styles.pill, active && styles.active, pressed && !active && styles.pressed]}>
            <Text style={[Typography.buttonSmall, { color: active ? Colors.onAccent : Colors.textSecondary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  pill: {
    minHeight: 44,
    paddingHorizontal: Space[4],
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Palette.purple[100],
  },
  active: { backgroundColor: Colors.accent },
  pressed: { backgroundColor: Colors.accentSoft },
});
