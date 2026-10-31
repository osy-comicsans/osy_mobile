import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Glass, Radius } from '@/common/lib/theme';
import { useGlassAppearance } from '@/common/providers/GlassAppearanceProvider';

export function GlassBackdrop({ accented = false }: { accented?: boolean }) {
  const { reduced, NativeGlass } = useGlassAppearance();
  if (!reduced && NativeGlass) return (
    <NativeGlass pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" colorScheme="light"
      glassEffectStyle="regular" isInteractive={false}
      tintColor={accented ? Glass.accentTint : Glass.tint} style={styles.fill} />
  );
  const webFilter = !reduced && Platform.OS === 'web'
    ? { backdropFilter: Glass.backdropFilter } as ViewStyle : undefined;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[
      styles.fill, webFilter,
      { backgroundColor: reduced ? (accented ? Colors.accentSoft : Colors.surface) : (accented ? Glass.accent : Glass.surface) },
    ]} />;
}

const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFill, borderRadius: Radius.lg } });
