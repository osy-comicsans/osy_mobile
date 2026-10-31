import '@/global.css';

import { Platform } from 'react-native';

import { getLanguage } from './i18n/i18n';
import { isRtl } from './i18n/languages';
import {
  ArabicFontFamily,
  createArabicTypography,
  FontFamily as LatinFontFamily,
  Typography as LatinTypography,
} from './tokens';

export { Colors, Glass, Palette, Priority, Radius, Shadow, Space, type ThemeColor } from './tokens';

// Switching to or from Arabic reloads the app, so these are fixed for each run.
const arabic = isRtl(getLanguage());
export const FontFamily = arabic ? ArabicFontFamily : LatinFontFamily;
export const Typography = arabic ? createArabicTypography() : LatinTypography;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
