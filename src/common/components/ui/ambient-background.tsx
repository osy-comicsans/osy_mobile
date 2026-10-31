import { StyleSheet, View } from 'react-native';

import { Colors } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';

/*
 * DESIGN.md §2.1 — static ambient canvas.
 * CSS gradient strings are used because RN Web passes them through to
 * background-image, while the native StyleSheet parser understands the same
 * linear/radial syntax. Object-array gradients render as [object Object] on web.
 */
const lavenderFade =
  'linear-gradient(180deg, #ECE0FF 0%, #F5F5F5 38%, #F5F5F5 100%)';
const purpleHaze =
  'radial-gradient(ellipse farthest-corner at 100% 0%, rgba(99,22,219,0.045) 0%, rgba(99,22,219,0) 58%)';
const whiteLift =
  'radial-gradient(ellipse farthest-corner at 0% 0%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 52%)';

/**
 * Purely decorative: no touches, no animation, sits behind content.
 * Kept deliberately subtle so cards, text, and borders stay dominant.
 */
export function AmbientBackground() {
  const theme = useTheme();
  if (theme.background !== Colors.background) return <View pointerEvents="none" accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[styles.layer, { backgroundColor: theme.background }]} />;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}>
      <View style={[styles.fill, { experimental_backgroundImage: lavenderFade }]} />
      <View style={[styles.fill, { experimental_backgroundImage: purpleHaze }]} />
      <View style={[styles.fill, { experimental_backgroundImage: whiteLift }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.background,
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
