import { AccessibilityInfo, Platform } from 'react-native';

export function nativeGlassView(): typeof import('expo-glass-effect').GlassView | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional native view must stay behind the runtime guard.
    const glass = require('expo-glass-effect') as typeof import('expo-glass-effect');
    return glass.isGlassEffectAPIAvailable() && glass.isLiquidGlassAvailable() ? glass.GlassView : null;
  } catch { return null; }
}

export function subscribeReducedTransparency(listener: (reduced: boolean) => void) {
  if (Platform.OS !== 'ios') { listener(false); return () => {}; }
  let active = true;
  void AccessibilityInfo.isReduceTransparencyEnabled().then(
    (value) => { if (active) listener(value); },
    () => { if (active) listener(true); },
  );
  const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', listener);
  return () => { active = false; subscription.remove(); };
}
