import { StyleSheet } from 'react-native';

import { lab } from './playgroundTheme';

export const sectionStyles = StyleSheet.create({
  values: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: lab.muted, fontSize: 11, lineHeight: 18 },
  label: { color: lab.accent, fontFamily: lab.mono, fontSize: 10, letterSpacing: 0.5 },
  count: { color: lab.text, fontFamily: lab.mono, fontSize: 58, fontVariant: ['tabular-nums'], letterSpacing: -2 },
  countPanel: { padding: 16, backgroundColor: lab.inset, borderRadius: 12, gap: 6 },
});
