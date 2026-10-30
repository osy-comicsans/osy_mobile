import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Colors } from '@/common/lib/theme';

const SIZE = 240;
const SEGMENT_LENGTH = 16;
const SEGMENT_WIDTH = 5;
const RADIUS = (SIZE - SEGMENT_LENGTH) / 2;
const FADED_OPACITY = 0.12;

type CountdownRingProps = PropsWithChildren<{
  total: number;
  remaining: number;
  confirmed: boolean;
}>;

// One segment per second, spent clockwise from the top. Remount it with a new
// `key` to start the next round with a full ring.
export function CountdownRing({ total, remaining, confirmed, children }: CountdownRingProps) {
  const elapsed = total - remaining;

  return (
    <View style={styles.ring}>
      {Array.from({ length: total }, (_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.segment,
            {
              backgroundColor: confirmed ? Colors.success : Colors.error,
              opacity: confirmed || index >= elapsed ? 1 : FADED_OPACITY,
              transform: [{ rotate: `${(index * 360) / total}deg` }, { translateY: -RADIUS }],
            },
          ]}
        />
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
    transitionProperty: ['opacity', 'backgroundColor'],
    transitionDuration: 300,
  },
});
