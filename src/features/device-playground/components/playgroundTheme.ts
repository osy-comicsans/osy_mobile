import { Platform } from 'react-native';

import { FontFamily } from '@/common/lib/theme';

/**
 * Device Lab keeps a dark, technical identity but is derived from the OSY
 * palette: charcoal surfaces, lavender accents, purple primary, semantic status.
 */
export const lab = {
  background: '#10171C',
  card: '#171F25',
  inset: '#0D1318',
  border: '#292832',
  text: '#F5F5F5',
  muted: '#9A8EAA',
  accent: '#B78AFF',
  accentFill: '#6316DB',
  accentSoft: '#ECE0FF',
  green: '#05CD99',
  red: '#F26464',
  redFill: '#EE1D1D',
  stopped: '#9A8EAA',
  x: '#B78AFF',
  y: '#05CD99',
  z: '#F97316',
  dangerBg: 'rgba(238,29,29,0.16)',
  errorBg: 'rgba(238,29,29,0.12)',
  noticeBg: 'rgba(5,205,153,0.12)',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  font: FontFamily.regular,
  fontMedium: FontFamily.medium,
  fontSemiBold: FontFamily.semiBold,
  fontBold: FontFamily.bold,
} as const;
