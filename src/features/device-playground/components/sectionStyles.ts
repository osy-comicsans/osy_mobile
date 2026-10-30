import { StyleSheet } from 'react-native';

import { Radius } from '@/common/lib/theme';
import { lab } from './playgroundTheme';

export const sectionStyles = StyleSheet.create({
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: lab.muted, fontFamily: lab.font, fontSize: 13, lineHeight: 18 },
  label: { color: lab.accent, fontFamily: lab.fontMedium, fontSize: 11, letterSpacing: 0.88, textTransform: 'uppercase' },
  count: { color: lab.text, fontFamily: lab.mono, fontSize: 58, fontVariant: ['tabular-nums'], letterSpacing: -2 },
  countPanel: { padding: 16, backgroundColor: lab.inset, borderRadius: Radius.md, gap: 6 },
});
