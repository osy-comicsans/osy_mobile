import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Palette, Typography } from '@/common/lib/theme';
import { useFontFallback } from '@/common/providers/FontReadinessProvider';

const STEPS = [
  { name: 'auth.progress.account', count: 'auth.stepOne' },
  { name: 'auth.progress.documents', count: 'auth.stepTwo' },
  { name: 'auth.progress.review', count: 'auth.stepThree' },
] as const;

// Steps before `step` are full, the current one fills by `fill` (0 to 1).
export interface SignupStep {
  step: 0 | 1 | 2;
  fill: number;
}

export function SignupProgress({ step, fill }: SignupStep) {
  const { t } = useTranslation();
  const fontFallback = useFontFallback();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t(STEPS[step].count)}
      accessibilityValue={{ text: t(STEPS[step].name) }}
      style={styles.row}>
      {STEPS.map(({ name }, index) => {
        const current = index === step;
        const amount = index < step ? 1 : current ? fill : 0;
        return (
          <View key={name} style={styles.segment}>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${Math.round(amount * 100)}%` }]} />
            </View>
            <Text numberOfLines={1} style={[current ? styles.current : styles.label, fontFallback]}>{t(name)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.28)' },
  bar: { height: 6, backgroundColor: Palette.white },
  label: { ...Typography.label, color: Palette.purple[200] },
  current: { ...Typography.labelStrong, color: Colors.onAccent },
});
