import { Image } from 'expo-image';
import { useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { SplashBrand, type LoadingTone } from '@/common/lib/startup/brand';

const ASPECT_RATIO = 1200 / 357;
export const EMBLEM_COLOR = '#5A17E5';
// From the logo's center to the emblem's, on the 1200 wide art.
export const EMBLEM_CENTER_OFFSET = SplashBrand.logoWidth * (237 / 1200 - 0.5);
const LETTERS = { light: '#171F25', dark: '#FFFFFF' } as const;

// The arrow is a cut-out, so the emblem is sliced where its shaft runs straight
// (x 312 to 345 of 1200). Stretching that strip lengthens the shaft and moves the
// head with it, leaving the head and the rounded end undistorted.
const STRIP_WIDTH = SplashBrand.logoWidth * (33 / 1200);
const STRETCH_POINTS = 64;
const STRIP_SCALE = 1 + STRETCH_POINTS / STRIP_WIDTH;
const LAYERS = 4;
const EMBLEM_RIGHT_EDGE = `${(474 / 1200) * 100}% 50%`;
// Past home the spring squashes the emblem against the letters, like a band gone slack.
const SQUASH = { inputRange: [-0.12, 0], outputRange: [0.93, 1], extrapolate: 'clamp' } as const;
const pull = (outputRange: number[]) => ({ inputRange: [0, 1], outputRange, extrapolateLeft: 'clamp' as const });

function Layer({ source, color, onReady }: { source: number; color: string; onReady: () => void }) {
  return <Image source={source} tintColor={color} contentFit="contain" transition={0} accessible={false}
    style={StyleSheet.absoluteFill} onLoadEnd={onReady} onError={onReady} />;
}

export function SplashLogo({ tone, stretch, onReady }: {
  tone: LoadingTone; stretch: Animated.Value; onReady: () => void;
}) {
  const loaded = useRef(0);
  const ready = () => { loaded.current += 1; if (loaded.current === LAYERS) onReady(); };
  const width = SplashBrand.logoWidth;
  return (
    <View style={{ width, height: width / ASPECT_RATIO }}>
      <View style={StyleSheet.absoluteFill}><Layer source={require('@/assets/brand/osy-logo-letters.png')} color={LETTERS[tone]} onReady={ready} /></View>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: EMBLEM_RIGHT_EDGE, transform: [{ scaleX: stretch.interpolate(SQUASH) }] }]}>
        <View style={StyleSheet.absoluteFill}><Layer source={require('@/assets/brand/osy-logo-emblem-right.png')} color={EMBLEM_COLOR} onReady={ready} /></View>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `${(345 / 1200) * 100}% 50%`,
          transform: [{ scaleX: stretch.interpolate(pull([1, STRIP_SCALE])) }] }]}>
          <Layer source={require('@/assets/brand/osy-logo-emblem-strip.png')} color={EMBLEM_COLOR} onReady={ready} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: stretch.interpolate(pull([0, -STRETCH_POINTS])) }] }]}>
          <Layer source={require('@/assets/brand/osy-logo-emblem-left.png')} color={EMBLEM_COLOR} onReady={ready} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
