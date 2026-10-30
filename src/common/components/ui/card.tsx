import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Shadow } from '@/common/lib/theme';

export type CardTone = 'surface' | 'muted' | 'accentSoft';

export type CardProps = PropsWithChildren<
  ViewProps & {
    tone?: CardTone;
    padded?: boolean;
  }
>;

const toneStyles = {
  surface: { backgroundColor: Colors.surface, boxShadow: Shadow.soft },
  muted: { backgroundColor: Colors.backgroundElement },
  accentSoft: { backgroundColor: Colors.accentSoft },
} as const;

export function Card({ tone = 'surface', padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[styles.base, toneStyles[tone], padded && styles.padded, style]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  padded: { padding: 24 },
});
