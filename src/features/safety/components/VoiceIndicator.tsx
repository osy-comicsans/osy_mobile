import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useStore } from 'zustand';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { Colors, Radius, Space } from '@/common/lib/theme';

import type { VoiceCheckIn } from '../utils/voiceCheckIn';

const MIC_SIZE = 48;

const captions = {
  speaking: 'checkIn.voice.speaking',
  listening: 'checkIn.voice.listening',
  denied: 'checkIn.voice.denied',
  unavailable: 'checkIn.voice.unavailable',
} as const;

export function VoiceIndicator({ voice, escalated }: { voice: VoiceCheckIn; escalated: boolean }) {
  const { t } = useTranslation();
  const status = useStore(voice.store, (state) => state.status);
  const reduceMotion = useReducedMotion();
  const level = useSharedValue(0);

  // Read outside React, so the level does not re-render the screen ten times a second.
  useEffect(() => voice.store.subscribe((state) => {
    level.set(withTiming(state.level, { duration: 120 }));
  }), [level, voice]);

  const innerRing = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1.15 : 1.1 + level.get() * 0.35 }],
  }));
  const outerRing = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1.35 : 1.2 + level.get() * 0.7 }],
  }));

  if (status === 'off') return null;
  const live = status === 'speaking' || status === 'listening';
  const caption = status === 'listening' && escalated ? 'checkIn.voice.listeningEscalated' : captions[status];

  return (
    <View style={styles.row}>
      <View style={styles.mic} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {status === 'listening' && (
          <>
            <Animated.View style={[styles.ring, styles.outerRing, outerRing]} />
            <Animated.View style={[styles.ring, innerRing]} />
          </>
        )}
        <View style={[styles.circle, !live && styles.circleOff]}>
          <Icon
            name={status === 'speaking' ? 'speaker' : live ? 'mic' : 'micOff'}
            size={22}
            color={live ? Colors.accent : Colors.textTertiary}
          />
        </View>
      </View>
      <ThemedText type="body" themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.caption}>
        {t(caption)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space[4], paddingHorizontal: Space[2] },
  mic: { width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.accent,
    opacity: 0.3,
  },
  outerRing: { opacity: 0.14 },
  circle: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentSoft,
  },
  circleOff: { backgroundColor: Colors.backgroundElement },
  caption: { flex: 1 },
});
