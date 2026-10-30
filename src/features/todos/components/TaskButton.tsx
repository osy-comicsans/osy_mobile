import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { useTheme } from '@/common/hooks/use-theme';

interface TaskButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function TaskButton({ label, onPress, disabled, primary, accessibilityLabel, testID }: TaskButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? '#1B65C2' : theme.backgroundElement },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <ThemedText type="smallBold" style={primary ? styles.primaryLabel : undefined}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  dimmed: { opacity: 0.5 },
  primaryLabel: { color: '#FFFFFF' },
});
