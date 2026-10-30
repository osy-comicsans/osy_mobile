import { useState, type ComponentRef, type Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Colors, Radius, Typography } from '@/common/lib/theme';

export type InputHandle = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  ref?: Ref<InputHandle>;
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({
  label,
  error,
  containerStyle,
  style,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.textTertiary}
        editable={editable}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          disabled && styles.disabled,
          error ? styles.errorBorder : focused && styles.focusedBorder,
          style,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { ...Typography.labelMedium, color: Colors.textSecondary },
  input: {
    ...Typography.body,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
  },
  focusedBorder: {
    borderColor: Colors.accent,
    boxShadow: '0 0 0 3px rgba(99,22,219,0.12)',
  },
  errorBorder: { borderColor: Colors.error },
  disabled: { backgroundColor: Colors.backgroundElement, color: Colors.textTertiary },
  errorText: { ...Typography.label, color: Colors.errorText },
});
