import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

import { useReducedMotion } from '@/common/hooks/use-reduced-motion';
import { SplashBrand, type LoadingTone } from '@/common/lib/startup/brand';
import { hideNativeSplash } from '@/common/lib/startup/nativeSplash';
import type { StartupSnapshot } from '@/common/lib/startup/startupCoordinator';
import { EMBLEM_CENTER_OFFSET, EMBLEM_COLOR, SplashLogo } from './ui/splash-logo';

export function StartupSplash({ snapshot, emergency, tone, onArtworkReady, onDismiss }: {
  snapshot: StartupSnapshot; emergency: boolean; tone: LoadingTone;
  onArtworkReady: () => void; onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  // Drawn at full size and scaled down, so its edge stays sharp as it grows.
  const fillSize = 2 * Math.hypot(width / 2 + Math.abs(EMBLEM_CENTER_OFFSET), height / 2);
  const [opacity] = useState(() => new Animated.Value(1));
  const [stretch] = useState(() => new Animated.Value(0));
  const [zoom] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(0));
  const [dismissed, setDismissed] = useState(false);
  const hidden = useRef(false);

  useEffect(() => {
    if (!snapshot.ready && !(emergency && snapshot.contentReady)) return;
    if (dismissed) return;
    let firstFrame: number;
    let secondFrame: number;
    let animation: Animated.CompositeAnimation | undefined;
    let snap: Animated.CompositeAnimation | undefined;
    let active = true;
    const finish = () => {
      if (!active) return;
      setDismissed(true);
      onDismiss();
    };
    // Let the already-mounted navigator and font/fallback styles paint before
    // handing off native -> matching JS artwork -> the first screen.
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!hidden.current) { hideNativeSplash(); hidden.current = true; }
        if (emergency || reducedMotion) { finish(); return; }
        const timing = (value: Animated.Value, toValue: number, duration: number, easing: (t: number) => number) =>
          Animated.timing(value, { toValue, duration, easing, useNativeDriver: true, isInteraction: false });
        // Pulled back, then let go. The arrow snaps home and zooms out of the emblem as
        // the app icon, on purple that fills the screen, then flies past into the app.
        animation = timing(stretch, 1, SplashBrand.stretchDurationMs, Easing.bezier(0.33, 0, 0.2, 1));
        animation.start(({ finished }) => {
          if (!finished || !active) return;
          snap = Animated.spring(stretch, { toValue: 0, tension: 210, friction: 11, useNativeDriver: true, isInteraction: false });
          snap.start();
          animation = Animated.sequence([
            Animated.delay(SplashBrand.releaseLeadMs),
            timing(zoom, 1, SplashBrand.zoomDurationMs, Easing.bezier(0.45, 0, 0.25, 1)),
            Animated.delay(SplashBrand.iconHoldMs),
            Animated.parallel([
              timing(reveal, 1, SplashBrand.revealDurationMs, Easing.in(Easing.cubic)),
              timing(opacity, 0, SplashBrand.revealDurationMs, Easing.in(Easing.quad)),
            ]),
          ]);
          animation.start((result) => { if (result.finished) finish(); });
        });
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      animation?.stop();
      snap?.stop();
    };
  }, [dismissed, emergency, onDismiss, opacity, reducedMotion, snapshot.contentReady, snapshot.ready, reveal, stretch, zoom]);

  // Emergency route visibility is immediate, including during an in-flight fade.
  if (dismissed || emergency) return null;
  return (
    <Animated.View
      pointerEvents="none" accessible accessibilityRole="progressbar"
      accessibilityLabel={t('loading.app')} accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={[styles.overlay, { backgroundColor: SplashBrand[tone].background, opacity }]}>
      <SplashLogo tone={tone} stretch={stretch} onReady={onArtworkReady} />
      <Animated.View style={[styles.fill, {
        width: fillSize, height: fillSize, borderRadius: fillSize / 2, backgroundColor: EMBLEM_COLOR,
        transform: [{ translateX: EMBLEM_CENTER_OFFSET }, { scale: zoom.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 1, 1] }) }],
      }]} />
      <Animated.View style={[styles.mark, {
        opacity: zoom.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [
          { translateX: zoom.interpolate({ inputRange: [0, 1], outputRange: [EMBLEM_CENTER_OFFSET, 0] }) },
          { scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.5] }) },
          { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 4] }) },
        ],
      }]}>
        <Image source={require('@/assets/brand/osy-app-mark.png')} contentFit="contain" transition={0} accessible={false} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  fill: { position: 'absolute' },
  // Drawn large and scaled down, like the fill, so it stays sharp at full size.
  mark: { position: 'absolute', width: 280, height: 280 * (1006 / 1120) },
});
