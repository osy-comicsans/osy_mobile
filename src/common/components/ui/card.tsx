import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Palette, Radius } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';

// `ink` is the brand's charcoal and `brand` its purple, for the one card a screen leads with.
export type CardTone = 'surface' | 'muted' | 'accentSoft' | 'ink' | 'brand';

export type CardProps = PropsWithChildren<ViewProps & { tone?: CardTone; padded?: boolean }>;

export function Card({ tone = 'surface', padded = true, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  const backgroundColor = {
    surface: theme.surface,
    muted: theme.backgroundElement,
    accentSoft: theme.accentSoft,
    ink: Palette.neutral[800],
    brand: Palette.purple[500],
  }[tone];
  return <View style={[styles.base, { backgroundColor }, padded && styles.padded, style]} {...rest}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.xl, borderCurve: 'continuous' },
  padded: { padding: 20 },
});
