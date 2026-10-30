import { Colors, Palette } from '../tokens';

export const SplashBrand = {
  imageSize: 240,
  fadeDurationMs: 200,
  light: { background: Colors.background, foreground: Colors.accent },
  dark: { background: Palette.neutral[800], foreground: Palette.purple[100] },
} as const;

export type LoadingTone = 'light' | 'dark';
