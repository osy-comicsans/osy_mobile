export function nativeGlassView(): typeof import('expo-glass-effect').GlassView | null { return null; }

export function subscribeReducedTransparency(listener: (reduced: boolean) => void) {
  if (typeof window === 'undefined' || !window.matchMedia) { listener(true); return () => {}; }
  const preference = window.matchMedia('(prefers-reduced-transparency: reduce)');
  const contrast = window.matchMedia('(prefers-contrast: more)');
  const changed = () => listener(preference.matches || contrast.matches);
  changed();
  preference.addEventListener('change', changed);
  contrast.addEventListener('change', changed);
  return () => { preference.removeEventListener('change', changed); contrast.removeEventListener('change', changed); };
}
