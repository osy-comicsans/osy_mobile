import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Typography } from '@/common/lib/theme';

export function Checkbox({
  checked,
  onPress,
  disabled = false,
  accessibilityLabel,
  label,
}: {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.hitArea}>
      <Text
        style={[
          styles.box,
          checked ? styles.checked : styles.unchecked,
          disabled && styles.disabled,
        ]}>
        {checked ? '✓' : ''}
      </Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  box: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    textAlign: 'center',
    lineHeight: 21,
    overflow: 'hidden',
  },
  checked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    color: Colors.onAccent,
    ...Typography.labelMedium,
  },
  unchecked: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.borderStrong,
    ...Typography.labelMedium,
  },
  disabled: { opacity: 0.5 },
  label: { ...Typography.bodyMedium, color: Colors.textPrimary },
});
