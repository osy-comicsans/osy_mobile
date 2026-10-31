import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Glass, Radius, Shadow } from '@/common/lib/theme';
import { GlassBackdrop } from './glass-backdrop';
import { useTheme } from '@/common/hooks/use-theme';

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
  const theme = useTheme();
  return (
    <View
      style={[styles.base, { borderColor: theme.border }, glass ? [styles.glass, theme.background !== Colors.background && { borderColor: theme.border }]
        : [toneStyles[tone], { backgroundColor: tone === 'accentSoft' ? theme.accentSoft : tone === 'muted' ? theme.backgroundElement : theme.surface }], padded && styles.padded, style]}
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
