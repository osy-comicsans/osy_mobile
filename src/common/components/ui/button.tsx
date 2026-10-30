import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, Palette, Radius, Shadow, Typography } from '@/common/lib/theme';
import { useFontFallback } from '@/common/providers/FontReadinessProvider';
import { LoadingIndicator } from './loading';

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'text' | 'destructive';
export type ButtonSize = 'large' | 'medium' | 'small';
export type ButtonTone = 'light' | 'dark';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label?: string;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const sizes = {
  large: { height: 48, paddingHorizontal: 24, type: Typography.buttonLarge },
  medium: { height: 40, paddingHorizontal: 20, type: Typography.buttonMedium },
  small: { height: 32, paddingHorizontal: 16, type: Typography.buttonSmall },
} as const;

function palette(variant: ButtonVariant, tone: ButtonTone) {
  const dark = tone === 'dark';
  switch (variant) {
    case 'primary':
      return { bg: Colors.accent, fg: Colors.onAccent, border: 'transparent', borderWidth: 0 };
    case 'destructive':
      return dark
        ? { bg: 'rgba(238,29,29,0.16)', fg: Colors.logoutText, border: 'transparent', borderWidth: 0 }
        : { bg: Colors.error, fg: Colors.onAccent, border: 'transparent', borderWidth: 0 };
    case 'secondary':
      return {
        bg: 'transparent',
        fg: dark ? Palette.purple[300] : Colors.accent,
        border: dark ? Palette.purple[300] : Colors.accent,
        borderWidth: 1.5,
      };
    case 'subtle':
      return {
        bg: 'transparent',
        fg: dark ? Colors.textPrimary : Colors.accent,
        border: dark ? Palette.neutral[700] : Colors.border,
        borderWidth: 1,
      };
    case 'text':
    default:
      return {
        bg: 'transparent',
        fg: dark ? Palette.purple[300] : Colors.accent,
        border: 'transparent',
        borderWidth: 0,
      };
  }
}

export function Button({
  label,
  children,
  variant = 'primary',
  size = 'medium',
  tone = 'light',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  ...rest
}: ButtonProps) {
  const { t } = useTranslation();
  const fontFallback = useFontFallback();
  const accessibleLabel = rest.accessibilityLabel ?? label ?? (typeof children === 'string' ? children : t('loading.action'));
  const dims = sizes[size];
  const colors = palette(variant, tone);
  const isDisabled = disabled || loading;
  const pressedBg =
    variant === 'primary'
      ? Colors.accentActive
      : variant === 'destructive'
        ? 'rgba(238,29,29,0.24)'
        : tone === 'dark'
          ? 'rgba(236,224,255,0.08)'
          : Colors.accentSoft;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}
      accessibilityState={{ ...rest.accessibilityState, disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: dims.height,
          paddingHorizontal: dims.paddingHorizontal,
          backgroundColor: pressed ? pressedBg : colors.bg,
          borderColor: colors.border,
          borderWidth: colors.borderWidth,
        },
        variant === 'primary' && tone === 'light' && styles.accentGlow,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <LoadingIndicator label={accessibleLabel} color={colors.fg} decorative />
      ) : (
        <>
          {leftIcon}
          <Text style={[dims.type, { color: colors.fg }, fontFallback]} numberOfLines={1}>
            {label}
            {children}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
  },
  accentGlow: { boxShadow: Shadow.accent },
  disabled: { opacity: 0.5 },
});
