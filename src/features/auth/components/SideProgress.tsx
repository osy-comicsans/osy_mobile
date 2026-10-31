import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/common/components/ui/icon';
import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';

type StepState = 'done' | 'current' | 'upcoming';

const looks = {
  done: { background: Colors.accentSoft, number: Colors.accent, label: Colors.accentActive },
  current: { background: Colors.accent, number: Colors.accent, label: Colors.onAccent },
  upcoming: { background: Colors.backgroundElement, number: Colors.textSecondary, label: Palette.neutral[600] },
} as const;

function Step({ number, label, state }: { number: number; label: string; state: StepState }) {
  const look = looks[state];
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ selected: state === 'current' }}
      style={[styles.step, { backgroundColor: look.background }]}>
      <View style={styles.number}>
        {state === 'done'
          ? <Icon name="check" size={14} color={look.number} />
          : <Text style={[styles.numberText, { color: look.number }]}>{number}</Text>}
      </View>
      <Text numberOfLines={1} style={[styles.label, { color: look.label }]}>{label}</Text>
    </View>
  );
}

export function SideProgress({ side }: { side: 'front' | 'back' }) {
  const { t } = useTranslation();
  const onBack = side === 'back';

  return (
    <View style={styles.row}>
      <Step number={1} label={t('documents.front')} state={onBack ? 'done' : 'current'} />
      <Step number={2} label={t('documents.back')} state={onBack ? 'current' : 'upcoming'} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Space[2] },
  step: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    height: 40,
    borderRadius: Radius.full,
  },
  number: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  numberText: Typography.labelStrong,
  label: Typography.bodyStrong,
});
