import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';

export type InputHandle = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  ref?: Ref<InputHandle>;
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

const LABEL_RESTING_TOP = 14;
const LABEL_FLOATING_TOP = -9;
const LABEL_RESTING_SIZE = 14;
const LABEL_FLOATING_SIZE = 12;
const LABEL_DURATION = 150;

export function Input({
  ref,
  label,
  hint,
  error,
  leadingIcon,
  trailing,
  containerStyle,
  style,
  value,
  placeholder,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const disabled = editable === false;
  const floating = focused || !!value;
  const progress = useSharedValue(floating ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(floating ? 1 : 0, { duration: LABEL_DURATION });
  }, [floating, progress]);

  // DESIGN.md §8.2: the label rests inside the field, then notches into the top border.
  const labelMotion = useAnimatedStyle(() => ({
    top: LABEL_RESTING_TOP + (LABEL_FLOATING_TOP - LABEL_RESTING_TOP) * progress.value,
    fontSize: LABEL_RESTING_SIZE + (LABEL_FLOATING_SIZE - LABEL_RESTING_SIZE) * progress.value,
  }));

  const labelColor = error ? Colors.errorText : focused ? Colors.accent : Colors.textTertiary;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View
        style={[
          styles.field,
          { backgroundColor: theme.surface, borderColor: theme.border },
          !!value && styles.filled,
          disabled && styles.disabled,
          focused && styles.focused,
          !!error && styles.error,
        ]}>
        {leadingIcon && <View style={styles.leading}>{leadingIcon}</View>}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          value={value}
          placeholder={floating ? placeholder : undefined}
          placeholderTextColor={theme.textTertiary}
          selectionColor={Colors.accent}
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
          style={[styles.input, { color: theme.textPrimary }, disabled && styles.inputDisabled, rest.keyboardType === 'phone-pad' && styles.phone, style]}
        />
        {trailing && <View style={styles.trailing}>{trailing}</View>}
        {label ? (
          <Animated.Text
            pointerEvents="none"
            numberOfLines={1}
            style={[
              styles.label,
              leadingIcon && !floating ? styles.labelAfterIcon : undefined,
              floating && styles.labelFloating,
              floating && { backgroundColor: theme.surface },
              { color: labelColor },
              labelMotion,
            ]}>
            {label}
          </Animated.Text>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Space[1] + 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    boxShadow: '0 1px 2px rgba(23,31,37,0.04)',
  },
  filled: { borderColor: Colors.borderStrong },
  focused: { borderColor: Colors.accent, boxShadow: '0 0 0 3px rgba(99,22,219,0.12)' },
  error: { borderColor: Colors.error },
  disabled: { backgroundColor: Palette.neutral[50], opacity: 0.7 },
  leading: { paddingStart: Space[4] },
  trailing: { paddingEnd: Space[2] },
  input: {
    ...Typography.body,
    flex: 1,
    minHeight: 46,
    paddingHorizontal: Space[3],
    paddingVertical: 12,
    color: Colors.textPrimary,
    // Web browsers add their own focus outline, which the ring above replaces.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  inputDisabled: { color: Colors.textTertiary },
  // Phone numbers stay left to right in Arabic. Android already does this for phone fields.
  phone: { writingDirection: 'ltr' },
  label: {
    ...Typography.body,
    position: 'absolute',
    start: Space[3],
    maxWidth: '85%',
  },
  labelAfterIcon: { start: 44 },
  labelFloating: { backgroundColor: Colors.surface, paddingHorizontal: Space[1], lineHeight: 16 },
  hint: { ...Typography.label, color: Colors.textSecondary },
  errorText: { ...Typography.label, color: Colors.errorText },
});
