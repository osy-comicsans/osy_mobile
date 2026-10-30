import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '@/common/hooks/use-reduced-motion';
import { SplashBrand, type LoadingTone } from '@/common/lib/startup/brand';
import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';
import { useFontFallback } from '@/common/providers/FontReadinessProvider';
import { BrandMark } from './brand-mark';

export function LoadingIndicator({ label, color = Colors.accent, size = 'small', decorative = false }: {
  label?: string; color?: string; size?: 'small' | 'large'; decorative?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : label ?? t('loading.content')}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion={decorative ? 'none' : 'polite'}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}>
      <ActivityIndicator accessible={false} size={size} color={color} />
    </View>
  );
}

// This occupies its own screen, never a Modal or a global input-blocking layer.
// The check-in link remains a separate accessible action while data is loading.
export function FullScreenLoader({ label, description, tone = 'light' }: {
  label?: string; description?: string; tone?: LoadingTone;
}) {
  const { t } = useTranslation();
  const fallback = useFontFallback();
  const palette = SplashBrand[tone];
  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <BrandMark tone={tone} />
      <View style={styles.message}>
        <LoadingIndicator size="large" color={palette.foreground} label={label ?? t('loading.app')} />
        <Text style={[styles.title, { color: tone === 'dark' ? Palette.purple[100] : Colors.textPrimary }, fallback]}>{label ?? t('loading.screen')}</Text>
        {description ? <Text style={[styles.description, tone === 'dark' && { color: Palette.purple[200] }, fallback]}>{description}</Text> : null}
      </View>
      <Link href="/check-in" asChild>
        <Pressable accessibilityRole="button" style={styles.checkIn}>
          <Text style={[styles.checkInText, { color: palette.foreground }, fallback]}>{t('loading.checkIn')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

export function ContentSkeleton({ label, lines = 3, style }: { label?: string; lines?: number; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0.3));
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.8, duration: 750, useNativeDriver: true, isInteraction: false }),
      Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  return (
    <View
      accessible accessibilityRole="progressbar" accessibilityLabel={label ?? t('loading.content')}
      accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={[styles.skeleton, style]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View style={[styles.skeletonLines, !reducedMotion && { opacity }]}>
          {Array.from({ length: Math.max(1, Math.min(8, Math.floor(lines))) }, (_, index) => (
            <View key={index} style={[styles.line, index === 0 && styles.firstLine, index > 0 && index === lines - 1 && styles.lastLine]} />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space[6], gap: Space[6] },
  message: { alignItems: 'center', gap: Space[4], maxWidth: 360 },
  title: { ...Typography.headingM, textAlign: 'center' },
  description: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  checkIn: { minHeight: Space[12], justifyContent: 'center', paddingHorizontal: Space[6], borderRadius: Radius.full },
  checkInText: { ...Typography.labelMedium, textAlign: 'center', textDecorationLine: 'underline' },
  skeleton: { alignSelf: 'stretch', paddingVertical: Space[4] },
  skeletonLines: { gap: Space[3] },
  line: { height: Space[4], borderRadius: Radius.sm, backgroundColor: Colors.backgroundElement, width: '100%' },
  firstLine: { width: '62%', height: Space[5], backgroundColor: Colors.accentSoft },
  lastLine: { width: '82%' },
});
