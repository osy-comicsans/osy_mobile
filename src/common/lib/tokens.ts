/**
 * OSY design tokens — the React Native translation of DESIGN.md.
 * Pure constants only: no react-native or alias imports, so this module is safe
 * to require from Node-based tests.
 */

export const Palette = {
  purple: {
    100: '#ECE0FF',
    200: '#D8C2FF',
    300: '#B78AFF',
    400: '#8B4BEA',
    500: '#6316DB',
    600: '#5010B8',
    700: '#3F0D91',
    800: '#2C0A68',
    900: '#1A073D',
  },
  neutral: {
    50: '#F5F5F5',
    100: '#F0EAF8',
    200: '#E3D9F0',
    300: '#C8BBD8',
    400: '#9A8EAA',
    500: '#655B70',
    600: '#45404C',
    700: '#292832',
    800: '#171F25',
    900: '#10171C',
  },
  white: '#FFFFFF',
} as const;

/**
 * Flat, light-only semantic palette. Legacy starter keys are retained so the
 * existing themed components keep working unchanged.
 */
export const Colors = {
  text: '#171F25',
  background: '#F5F5F5',
  backgroundElement: '#F0EAF8',
  backgroundSelected: '#ECE0FF',
  textSecondary: '#655B70',

  textPrimary: '#171F25',
  textTertiary: '#9A8EAA',
  surface: '#FFFFFF',

  border: '#E3D9F0',
  borderStrong: '#C8BBD8',

  accent: '#6316DB',
  accentHover: '#5010B8',
  accentActive: '#3F0D91',
  accentSoft: '#ECE0FF',
  onAccent: '#FFFFFF',

  success: '#05CD99',
  successSoft: '#DCFCE7',
  successText: '#05A87C',
  error: '#EE1D1D',
  errorSoft: '#FDE2E2',
  errorText: '#E31A1A',
  warning: '#F97316',
  warningSoft: '#FFEDD5',
  logoutSoft: '#FDECEC',
  logoutText: '#F26464',

  overlay: 'rgba(23,31,37,0.25)',
  focusRing: 'rgba(99,22,219,0.20)',
} as const;

export type ThemeColor = keyof typeof Colors;

export const DarkColors: Record<ThemeColor, string> = {
  ...Colors, text: '#F5F5F5', textPrimary: '#F5F5F5', textSecondary: '#C8BBD8', textTertiary: '#9A8EAA',
  background: '#10171C', surface: '#171F25', backgroundElement: '#292832', backgroundSelected: '#2C0A68',
  border: '#45404C', borderStrong: '#655B70', accent: '#B78AFF', accentSoft: '#2C0A68',
  onAccent: '#171F25', accentActive: '#D8C2FF', accentHover: '#D8C2FF',
};

export const Priority = {
  low: Colors.success,
  medium: Colors.warning,
  high: Colors.error,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

/** RN 0.86 New Architecture accepts CSS-like boxShadow strings. */
export const Shadow = {
  xs: '0 1px 2px rgba(23,31,37,0.04)',
  sm: '0 2px 8px rgba(23,31,37,0.05)',
  md: '0 4px 16px rgba(23,31,37,0.07)',
  lg: '0 12px 32px rgba(23,31,37,0.10)',
  soft: '0 8px 24px rgba(23,31,37,0.08)',
  accent: '0 8px 24px rgba(99,22,219,0.30)',
} as const;

/** Frosted variants of the fixed OSY white/lavender/charcoal palette. */
export const Glass = {
  darkSurface: 'rgba(23,31,37,0.86)',
  darkAccent: 'rgba(44,10,104,0.88)',
  darkTint: 'rgba(23,31,37,0.32)',
  surface: 'rgba(255,255,255,0.86)',
  accent: 'rgba(236,224,255,0.88)',
  edge: 'rgba(255,255,255,0.92)',
  tint: 'rgba(255,255,255,0.32)',
  accentTint: 'rgba(216,194,255,0.28)',
  backdropFilter: 'blur(20px) saturate(125%)',
} as const;

/** 4px base scale from DESIGN §6. Access as Space[6]. */
export const Space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** These strings are also the useFonts map keys, so they resolve on all platforms. */
export const FontFamily = {
  regular: 'Gabarito_400Regular',
  medium: 'Gabarito_500Medium',
  semiBold: 'Gabarito_600SemiBold',
  bold: 'Gabarito_700Bold',
} as const;

/** Gabarito has no Arabic glyphs. Weights map one-to-one onto FontFamily. */
export const ArabicFontFamily = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semiBold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

/** DESIGN §3 type scale. letterSpacing is px (-2% / +8% of font size). */
export const Typography = {
  displayXL: { fontFamily: FontFamily.bold, fontSize: 64, lineHeight: 72, letterSpacing: -1.28 },
  displayL: { fontFamily: FontFamily.bold, fontSize: 50, lineHeight: 64, letterSpacing: -1.0 },
  displayM: { fontFamily: FontFamily.bold, fontSize: 42, lineHeight: 56, letterSpacing: -0.84 },
  displayS: { fontFamily: FontFamily.bold, fontSize: 34, lineHeight: 42, letterSpacing: -0.68 },
  displayXS: { fontFamily: FontFamily.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.48 },
  headingL: { fontFamily: FontFamily.bold, fontSize: 24, lineHeight: 32 },
  headingM: { fontFamily: FontFamily.semiBold, fontSize: 20, lineHeight: 28 },
  headingS: { fontFamily: FontFamily.semiBold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 22 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
  labelMedium: { fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.88,
    textTransform: 'uppercase' as const,
  },
  buttonLarge: { fontFamily: FontFamily.semiBold, fontSize: 16, lineHeight: 20 },
  buttonMedium: { fontFamily: FontFamily.semiBold, fontSize: 14, lineHeight: 20 },
  buttonSmall: { fontFamily: FontFamily.semiBold, fontSize: 13, lineHeight: 18 },
} as const;

const arabicFonts: Record<string, string> = {
  [FontFamily.regular]: ArabicFontFamily.regular,
  [FontFamily.medium]: ArabicFontFamily.medium,
  [FontFamily.semiBold]: ArabicFontFamily.semiBold,
  [FontFamily.bold]: ArabicFontFamily.bold,
};

/** Letter spacing breaks joined Arabic letters, and its marks need taller lines. */
export function createArabicTypography() {
  const styles = Object.entries(Typography).map(([name, style]) => {
    const { letterSpacing: _letterSpacing, ...rest } = style as typeof style & { letterSpacing?: number };
    return [name, {
      ...rest,
      fontFamily: arabicFonts[style.fontFamily],
      lineHeight: Math.ceil(style.lineHeight * 1.2),
    }];
  });
  return Object.fromEntries(styles) as unknown as typeof Typography;
}
