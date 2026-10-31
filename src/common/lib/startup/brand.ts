import { Colors, Palette } from '../tokens';

export const SplashBrand = {
  imageSize: 240,
  // The logo's width inside the square native splash art.
  logoWidth: 240 * (700 / 1024),
  fadeDurationMs: 200,
  stretchDurationMs: 700,
  releaseLeadMs: 110,
  zoomDurationMs: 420,
  iconHoldMs: 130,
  revealDurationMs: 340,
  light: { background: Colors.background, foreground: Colors.accent },
  dark: { background: Palette.neutral[800], foreground: Palette.purple[100] },
} as const;

export type LoadingTone = 'light' | 'dark';
