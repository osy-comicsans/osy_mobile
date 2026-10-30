import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SensorSnapshot } from '../types/sensor.types';
import { formatTimestamp } from '../utils/sensor.utils';
import { lab } from './playgroundTheme';
import { SensorStatus } from './SensorStatus';

export function LabButton({ label, onPress, disabled, danger, secondary, testID }: {
  label: string; onPress: () => void; disabled?: boolean; danger?: boolean; secondary?: boolean; testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} testID={testID}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, (disabled || pressed) && styles.dim]}>
      <Text style={[styles.buttonLabel, secondary && styles.secondaryLabel, danger && styles.dangerLabel]}>{label}</Text>
    </Pressable>
  );
}

export function SensorCard({ title, description, tag, state, onStart, onStop, controls, children }: PropsWithChildren<{
  title: string; description: string; tag: string; state: SensorSnapshot<unknown>;
  onStart: () => void; onStop: () => void; controls?: ReactNode;
}>) {
  const active = state.phase === 'running' || state.phase === 'starting' || state.refreshing;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.tag}>{tag}</Text>
        <SensorStatus phase={state.phase} />
      </View>
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.permissions}>
        <Text style={styles.meta}>Permission · {state.permission?.status ?? 'Not checked'}</Text>
        <Text style={styles.meta}>Hardware · {state.available === null ? 'Not checked' : state.available ? 'Available' : 'Unavailable'}</Text>
      </View>
      <View style={styles.controls}>
        <LabButton
          label={active ? state.phase === 'starting' ? `Cancel ${title}` : `Stop ${title}` : `Start ${title}`}
          onPress={active ? onStop : onStart} danger={active} testID={`toggle-${tag}`}
        />
        {controls}
      </View>
      {state.error && <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text>}
      {state.notice && <Text accessibilityRole="alert" style={styles.notice}>{state.notice}</Text>}
      {children}
      <Text style={styles.footer}>
        {state.updatedAt === null ? 'Awaiting hardware readings' : `${state.phase === 'running' ? 'Last received' : 'Last sample · stopped'} ${formatTimestamp(state.updatedAt)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: lab.card, borderColor: lab.border, borderWidth: 1, borderRadius: 18, padding: 18, gap: 16, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: { color: lab.accent, fontFamily: lab.mono, fontSize: 11, letterSpacing: 1.2 },
  heading: { gap: 6 },
  title: { color: lab.text, fontSize: 21, fontWeight: '600', letterSpacing: -0.3 },
  description: { color: lab.muted, fontSize: 12, lineHeight: 19 },
  permissions: { gap: 4 },
  meta: { color: lab.muted, fontFamily: lab.mono, fontSize: 10 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: lab.accent, minHeight: 44, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 9, justifyContent: 'center' },
  secondary: { backgroundColor: lab.inset, borderColor: lab.border, borderWidth: 1 },
  danger: { backgroundColor: '#36212C' },
  dim: { opacity: 0.5 },
  buttonLabel: { fontSize: 12, fontWeight: '700', color: lab.background },
  secondaryLabel: { color: lab.text },
  dangerLabel: { color: lab.red },
  error: { color: lab.red, backgroundColor: '#2B1D27', padding: 12, borderRadius: 8, fontSize: 12, lineHeight: 19 },
  notice: { color: lab.green, backgroundColor: '#14352D', padding: 14, borderRadius: 8, fontFamily: lab.mono, fontWeight: '700', letterSpacing: 1 },
  footer: { color: lab.muted, fontFamily: lab.mono, fontSize: 9, lineHeight: 15 },
});
