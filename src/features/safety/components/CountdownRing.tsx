import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Colors } from '@/common/lib/theme';

const SIZE = 240;
const SEGMENT_LENGTH = 16;
const SEGMENT_WIDTH = 5;
const RADIUS = (SIZE - SEGMENT_LENGTH) / 2;
const FADED_OPACITY = 0.12;
const FADE_DURATION = 300;

type CountdownRingProps = PropsWithChildren<{
  total: number;
  remaining: number;
  confirmed: boolean;
}>;

function Segment({ angle, spent, confirmed }: { angle: number; spent: boolean; confirmed: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(spent && !confirmed ? FADED_OPACITY : 1, { duration: FADE_DURATION }),
    backgroundColor: withTiming(confirmed ? Colors.success : Colors.error, { duration: FADE_DURATION }),
  }));

  return (
    <Animated.View
      style={[styles.segment, { transform: [{ rotate: `${angle}deg` }, { translateY: -RADIUS }] }, animatedStyle]}
    />
  );
}

// One segment per second, spent clockwise from the top. Remount it with a new
// `key` to start the next round with a full ring.
export function CountdownRing({ total, remaining, confirmed, children }: CountdownRingProps) {
  const elapsed = total - remaining;

  return (
    <View style={styles.ring}>
      {Array.from({ length: total }, (_, index) => (
        <Segment key={index} angle={(index * 360) / total} spent={index < elapsed} confirmed={confirmed} />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  segment: {
    position: 'absolute',
    width: SEGMENT_WIDTH,
    height: SEGMENT_LENGTH,
    borderRadius: SEGMENT_WIDTH / 2,
  },
});
