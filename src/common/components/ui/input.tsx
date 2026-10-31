import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
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

import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { Icon } from './icon';

export type InputHandle = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  ref?: Ref<InputHandle>;
  label?: string;
  hint?: string;
  error?: string;
  // Asks the user to check a value they did not type, such as one read from a document.
  warning?: string;
  valid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

function Message({ text, tone }: { text: string; tone: 'error' | 'warning' }) {
  const error = tone === 'error';
  return (
    <View accessibilityLiveRegion="polite" style={styles.message}>
      <View style={styles.messageIcon}>
        <Icon name={error ? 'error' : 'warning'} size={16} color={error ? Colors.errorText : Colors.warning} />
      </View>
      <Text style={[styles.messageText, { color: error ? Colors.errorText : Palette.neutral[600] }]}>{text}</Text>
    </View>
  );
}

export function Input({
  ref,
  label,
  hint,
  error,
  warning,
  valid,
  leading,
  trailing,
  containerStyle,
  style,
  editable = true,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const theme = useTheme();
  const disabled = editable === false;
  const flagged = !!error || !!warning;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: disabled ? theme.textTertiary : theme.textPrimary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.field,
          { backgroundColor: focused || flagged ? theme.surface : theme.background, borderColor: theme.borderField },
          focused && !flagged && styles.focused,
          !!warning && styles.warning,
          !!error && styles.error,
          disabled && { borderColor: theme.border },
        ]}>
        {leading}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
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
          style={[
            styles.input,
            { color: disabled ? theme.textTertiary : theme.textPrimary },
            (!!trailing || valid) && styles.inputBeforeTrailing,
            rest.keyboardType === 'phone-pad' && styles.phone,
            style,
          ]}
        />
        {valid && !flagged && (
          <View style={styles.valid}><Icon name="check" size={20} color={Colors.successText} /></View>
        )}
        {trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>
      {error ? (
        <Message tone="error" text={error} />
      ) : warning ? (
        <Message tone="warning" text={warning} />
      ) : hint ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Space[2] },
  label: { ...Typography.bodyStrong, color: Colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderField,
    backgroundColor: Colors.background,
  },
  focused: { borderWidth: 1.5, borderColor: Colors.accent, boxShadow: `0 0 0 4px ${Colors.focusRing}` },
  warning: { borderWidth: 1.5, borderColor: Colors.warning },
  error: { borderWidth: 1.5, borderColor: Colors.errorText },
  input: {
    ...Typography.bodyLarge,
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: Space[4],
    paddingVertical: 0,
    color: Colors.textPrimary,
    // Web browsers add their own focus outline, which the ring above replaces.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  inputBeforeTrailing: { paddingEnd: Space[3] },
  // Phone numbers stay left to right in Arabic. Android already does this for phone fields.
  phone: { writingDirection: 'ltr' },
  valid: { paddingEnd: Space[4] },
  trailing: { paddingEnd: Space[1] },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: Space[2] },
  messageIcon: { paddingTop: 1 },
  messageText: { ...Typography.label, flex: 1 },
  hint: { ...Typography.label, color: Colors.textSecondary },
});
