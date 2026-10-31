import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { useReducedMotion } from '@/common/hooks/use-reduced-motion';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';
import { useSpeedDisplay } from '@/features/settings/hooks/useSpeedDisplay';

// Display range only; this is independent of the current road's legal limit.
export const SPEEDOMETER_MAX_KMH = 240;
const TICK_COUNT = 24;
const TRACK_WIDTH = 14;
const KNOB_SIZE = 24;
const TICKS = Array.from({ length: TICK_COUNT + 1 }, (_, index) => ({
  fraction: index / TICK_COUNT,
  major: index % 6 === 0,
}));

// Drawn for the purple hero. Over the road's limit the arc turns orange, and a
// white notch marks where the limit sits on the scale.
export function Speedometer({ speedKmh, limitKmh = null }: { speedKmh: number | null; limitKmh?: number | null }) {
  const { t } = useTranslation();
  const language = getLanguage();
  const display = useSpeedDisplay(speedKmh);
  const limit = useSpeedDisplay(limitKmh);
  const maximum = display.units === 'mph' ? 160 : SPEEDOMETER_MAX_KMH;
  const reducedMotion = useReducedMotion();
  const [diameter, setDiameter] = useState(260);
  const radius = diameter / 2;
  const known = speedKmh !== null && Number.isFinite(speedKmh) && speedKmh >= 0;
  const fraction = known ? Math.min((display.value ?? 0) / maximum, 1) : 0;
  const limitFraction = limit.value === null ? null : Math.min(limit.value / maximum, 1);
  const over = known && limit.value !== null && (display.value ?? 0) > limit.value;
  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = withTiming(fraction, {
      duration: known && !reducedMotion ? 350 : 0,
      reduceMotion: ReduceMotion.System,
    });
  }, [fraction, known, progress, reducedMotion]);
  const arcMotion = useAnimatedStyle(() => ({ transform: [{ rotate: `${-180 + progress.value * 180}deg` }] }));
  const knobMotion = useAnimatedStyle(() => ({ transform: [{ rotate: `${-90 + progress.value * 180}deg` }] }));
  const circle = { width: diameter, height: diameter, borderRadius: radius };
  const tickRadius = radius - TRACK_WIDTH - Space[2];
  const labelRadius = Math.max(0, radius - TRACK_WIDTH - Space[8]);

  return (
    <View style={styles.root} accessible
      accessibilityLabel={known ? display.spoken : t('units.speedUnknown')}
      onLayout={({ nativeEvent }) => {
        const width = Math.round(nativeEvent.layout.width);
        if (width > 0) setDiameter(width);
      }}>
      <View style={[styles.dial, { height: radius + Space[8] }]} pointerEvents="none"
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.clip, { height: radius }]}>
          <View style={[styles.ring, circle]} />
          {known ? <Animated.View style={[styles.frame, circle, arcMotion]}>
            <View style={[styles.clip, { height: radius }]}>
              <View style={[styles.ring, circle, { borderColor: over ? Colors.warning : Palette.white }]} />
            </View>
          </Animated.View> : null}
        </View>
        {TICKS.map(({ fraction: position, major }, index) => {
          const angle = Math.PI * (1 - position);
          return (
            <View key={index} style={StyleSheet.absoluteFill}>
              <View style={[styles.tick, {
                top: radius, height: major ? Space[3] : Space[1],
                marginTop: -(major ? Space[3] : Space[1]) / 2,
                backgroundColor: major ? Palette.purple[100] : Palette.purple[300],
                transform: [
                  { translateX: Math.cos(angle) * tickRadius - 1 },
                  { translateY: -Math.sin(angle) * tickRadius },
                  { rotate: `${position * 180 - 90}deg` },
                ],
              }]} />
              {major ? <ThemedText type="small" maxFontSizeMultiplier={1.2} style={[styles.scale, {
                top: radius,
                transform: [{ translateX: Math.cos(angle) * labelRadius - 20 }, { translateY: -Math.sin(angle) * labelRadius }],
              }]}>{formatNumber(language, position * maximum)}</ThemedText> : null}
            </View>
          );
        })}
        {limitFraction !== null ? <View style={[styles.frame, circle, { transform: [{ rotate: `${-90 + limitFraction * 180}deg` }] }]}>
          <View style={styles.notch} />
        </View> : null}
        {known ? <Animated.View style={[styles.frame, circle, knobMotion]}>
          <View style={styles.knob} />
        </Animated.View> : null}
        <View style={styles.reading}>
          <ThemedText style={[Typography.displayL, styles.speed]} numberOfLines={1} adjustsFontSizeToFit>{known ? display.formatted : '—'}</ThemedText>
          <ThemedText type="label" style={styles.unit}>{display.unit}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 270, alignSelf: 'center' },
  dial: { overflow: 'hidden', direction: 'ltr' },
  clip: { position: 'absolute', top: 0, start: 0, end: 0, overflow: 'hidden' },
  ring: { position: 'absolute', top: 0, left: 0, borderWidth: TRACK_WIDTH, borderColor: Palette.purple[600] },
  // Center the dial parts with physical transforms so RTL cannot mirror the scale.
  frame: { position: 'absolute', top: 0, left: 0 },
  tick: { position: 'absolute', left: '50%', width: 2, borderRadius: Radius.full },
  scale: { position: 'absolute', left: '50%', width: 40, marginTop: -10, textAlign: 'center', color: Palette.purple[100] },
  notch: { position: 'absolute', top: -2, left: '50%', width: 4, height: TRACK_WIDTH + 4, transform: [{ translateX: -2 }], borderRadius: Radius.full, backgroundColor: Palette.neutral[800] },
  knob: {
    position: 'absolute', top: (TRACK_WIDTH - KNOB_SIZE) / 2 + 5, left: '50%', width: KNOB_SIZE, height: KNOB_SIZE, transform: [{ translateX: -KNOB_SIZE / 2 }],
    borderRadius: Radius.full, borderWidth: 5, borderColor: Palette.white, backgroundColor: Palette.purple[500],
  },
  reading: { position: 'absolute', start: 0, end: 0, bottom: 0, alignItems: 'center' },
  speed: { color: Colors.onAccent },
  unit: { color: Palette.purple[100] },
});
