import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const BRAND_NAME = 'OSY';
const ASPECT_RATIO = 1200 / 357;
const DURATION_MS = 900;

// The emblem pops in at the center and slides to its place, drawing the letters out behind it.
export function AnimatedLogo({ width, emblemColor, lettersColor, still = false }: {
  width: number; emblemColor: string; lettersColor: string; still?: boolean;
}) {
  const reducedMotion = useReducedMotion() || still;
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!reducedMotion) progress.set(withTiming(1, { duration: DURATION_MS, easing: Easing.inOut(Easing.cubic) }));
  }, [progress, reducedMotion]);

  const emblem = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.25], [0, 1], 'clamp'),
    transform: [
      { translateX: interpolate(progress.get(), [0.4, 1], [width * 0.3, 0], 'clamp') },
      { scale: interpolate(progress.get(), [0, 0.4], [0.7, 1], 'clamp') },
    ],
  }));
  const letters = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.55, 1], [0, 1], 'clamp'),
    transform: [{ translateX: interpolate(progress.get(), [0.4, 1], [-width * 0.1, 0], 'clamp') }],
  }));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={BRAND_NAME} style={{ width, height: width / ASPECT_RATIO }}>
      <Animated.View style={[StyleSheet.absoluteFill, letters]}>
        <Image source={require('@/assets/brand/osy-logo-letters.png')} tintColor={lettersColor} contentFit="contain" transition={0} accessible={false} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, emblem]}>
        <Image source={require('@/assets/brand/osy-logo-emblem.png')} tintColor={emblemColor} contentFit="contain" transition={0} accessible={false} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}
