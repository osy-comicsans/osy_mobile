import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { useReducedMotion } from '@/common/hooks/use-reduced-motion';
import { formatNumber } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { Radius, Space, Typography } from '@/common/lib/theme';
import { useTheme } from '@/common/hooks/use-theme';
import { useSpeedDisplay } from '@/features/settings/hooks/useSpeedDisplay';

// Display range only; this is independent of the current road's legal limit.
export const SPEEDOMETER_MAX_KMH = 240;
const TICK_COUNT = 24;
const TRACK_WIDTH = 12;
const TICKS = Array.from({ length: TICK_COUNT + 1 }, (_, index) => ({
  fraction: index / TICK_COUNT,
  major: index % 6 === 0,
}));

export function Speedometer({ speedKmh }: { speedKmh: number | null }) {
  const Colors = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const language = getLanguage();
  const display = useSpeedDisplay(speedKmh);
  const maximum = display.units === 'mph' ? 160 : SPEEDOMETER_MAX_KMH;
  const reducedMotion = useReducedMotion();
  const [diameter, setDiameter] = useState(240);
  const radius = diameter / 2;
  const known = speedKmh !== null && Number.isFinite(speedKmh) && speedKmh >= 0;
  const fraction = known ? Math.min((display.value ?? 0) / maximum, 1) : 0;
  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = withTiming(fraction, {
      duration: known && !reducedMotion ? 350 : 0,
      reduceMotion: ReduceMotion.System,
    });
  }, [fraction, known, progress, reducedMotion]);
  const arcMotion = useAnimatedStyle(() => ({ transform: [{ rotate: `${-180 + progress.value * 180}deg` }] }));
  const needleMotion = useAnimatedStyle(() => ({ transform: [{ rotate: `${-90 + progress.value * 180}deg` }] }));
  const speed = known ? display.formatted : '—';
  const circle = { width: diameter, height: diameter, borderRadius: radius };
  const tickRadius = radius - TRACK_WIDTH - Space[3];
  const labelRadius = Math.max(0, radius - TRACK_WIDTH - Space[10]);

  return (
    <View style={styles.root} accessible
      accessibilityLabel={known ? display.spoken : t('units.speedUnknown')}
      onLayout={({ nativeEvent }) => {
        const width = Math.round(nativeEvent.layout.width);
        if (width > 0) setDiameter(width);
      }}>
      <View style={[styles.dial, { height: radius + Space[4] }]} pointerEvents="none"
        accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.clip, { height: radius }]}>
          <View style={[styles.ring, circle]} />
          {known ? <Animated.View style={[styles.needleFrame, circle, arcMotion]}>
            <View style={[styles.clip, { height: radius }]}>
              <View style={[styles.ring, circle, styles.fill]} />
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
                backgroundColor: major ? Colors.textSecondary : Colors.borderStrong,
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
        {known ? <Animated.View style={[styles.needleFrame, { width: diameter, height: diameter }, needleMotion]}>
          <View style={[styles.needle, { top: radius - Math.max(0, labelRadius - Space[6]), height: Math.max(0, labelRadius - Space[6]) }]} />
        </Animated.View> : null}
        <View style={[styles.hub, { top: radius - Space[2] }]} />
      </View>
      <View style={styles.reading} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ThemedText style={Typography.displayXL} numberOfLines={1} adjustsFontSizeToFit>{speed}</ThemedText>
        <ThemedText type="bodyMedium" themeColor="textSecondary">{display.unit}</ThemedText>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  root: { width: '100%', maxWidth: 320, alignSelf: 'center', gap: Space[1] },
  dial: { overflow: 'hidden', direction: 'ltr' },
  clip: { position: 'absolute', top: 0, start: 0, end: 0, overflow: 'hidden' },
  ring: { position: 'absolute', top: 0, left: 0, borderWidth: TRACK_WIDTH, borderColor: Colors.accentSoft },
  // A half ring rotates behind a second upper-half clip: empty -> full.
  fill: { borderColor: Colors.accent },
  // Center the dial parts with physical transforms so RTL cannot mirror the scale.
  tick: { position: 'absolute', left: '50%', width: 2, borderRadius: Radius.full },
  scale: { position: 'absolute', left: '50%', width: 40, marginTop: -10, textAlign: 'center', color: Colors.textSecondary },
  needleFrame: { position: 'absolute', top: 0, left: 0 },
  needle: { position: 'absolute', left: '50%', transform: [{ translateX: -2 }], width: 4, borderRadius: Radius.full, backgroundColor: Colors.accent },
  hub: { position: 'absolute', left: '50%', transform: [{ translateX: -Space[2] }], width: Space[4], height: Space[4], borderRadius: Radius.full,
    borderWidth: Space[1], borderColor: Colors.accent, backgroundColor: Colors.surface },
  reading: { alignItems: 'center', gap: Space[1] },
});
