import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Glass, Radius } from '@/common/lib/theme';
import { useGlassAppearance } from '@/common/providers/GlassAppearanceProvider';
import { useTheme } from '@/common/hooks/use-theme';

export function GlassBackdrop({ accented = false }: { accented?: boolean }) {
  const { reduced, NativeGlass } = useGlassAppearance();
  const theme = useTheme();
  const dark = theme.background !== Colors.background;
  if (!reduced && NativeGlass) return (
    <NativeGlass pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" colorScheme={dark ? 'dark' : 'light'}
      glassEffectStyle="regular" isInteractive={false}
      tintColor={dark ? Glass.darkTint : accented ? Glass.accentTint : Glass.tint} style={styles.fill} />
  );
  const webFilter = !reduced && Platform.OS === 'web'
    ? { backdropFilter: Glass.backdropFilter } as ViewStyle : undefined;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[
      styles.fill, webFilter,
      { backgroundColor: reduced ? (accented ? theme.accentSoft : theme.surface)
        : dark ? (accented ? Glass.darkAccent : Glass.darkSurface) : (accented ? Glass.accent : Glass.surface) },
    ]} />;
}

const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFill, borderRadius: Radius.lg } });
