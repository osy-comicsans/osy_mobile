import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Glass, Radius, Shadow } from '@/common/lib/theme';
import { GlassBackdrop } from './glass-backdrop';

export type CardTone = 'surface' | 'muted' | 'accentSoft';

export type CardProps = PropsWithChildren<
  ViewProps & {
    tone?: CardTone;
    padded?: boolean;
    glass?: boolean;
  }
>;

const toneStyles = {
  surface: { backgroundColor: Colors.surface, boxShadow: Shadow.soft },
  muted: { backgroundColor: Colors.backgroundElement },
  accentSoft: { backgroundColor: Colors.accentSoft },
} as const;

export function Card({ tone = 'surface', padded = true, glass = false, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[styles.base, glass ? styles.glass : toneStyles[tone], padded && styles.padded, style]}
      {...rest}>
      {glass ? <GlassBackdrop accented={tone === 'accentSoft'} /> : null}
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
  glass: { overflow: 'hidden', backgroundColor: 'transparent', borderColor: Glass.edge, boxShadow: Shadow.soft },
});
