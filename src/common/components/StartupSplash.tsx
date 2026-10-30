import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet } from 'react-native';

import { useReducedMotion } from '@/common/hooks/use-reduced-motion';
import { SplashBrand, type LoadingTone } from '@/common/lib/startup/brand';
import { hideNativeSplash } from '@/common/lib/startup/nativeSplash';
import type { StartupSnapshot } from '@/common/lib/startup/startupCoordinator';
import { BrandMark } from './ui/brand-mark';

export function StartupSplash({ snapshot, emergency, tone, onArtworkReady, onDismiss }: {
  snapshot: StartupSnapshot; emergency: boolean; tone: LoadingTone;
  onArtworkReady: () => void; onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const [dismissed, setDismissed] = useState(false);
  const hidden = useRef(false);

  useEffect(() => {
    if (!snapshot.ready && !(emergency && snapshot.contentReady)) return;
    if (dismissed) return;
    let firstFrame: number;
    let secondFrame: number;
    let animation: Animated.CompositeAnimation | undefined;
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
        animation = Animated.timing(opacity, {
          toValue: 0, duration: SplashBrand.fadeDurationMs,
          easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false,
        });
        animation.start(({ finished }) => { if (finished) finish(); });
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      animation?.stop();
    };
  }, [dismissed, emergency, onDismiss, opacity, reducedMotion, snapshot.contentReady, snapshot.ready]);

  // Emergency route visibility is immediate, including during an in-flight fade.
  if (dismissed || emergency) return null;
  return (
    <Animated.View
      pointerEvents="none" accessible accessibilityRole="progressbar"
      accessibilityLabel={t('loading.app')} accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      style={[styles.overlay, { backgroundColor: SplashBrand[tone].background, opacity }]}>
      <BrandMark tone={tone} onReady={onArtworkReady} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
});
