import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/common/components/ui/button';
import { Radius, Shadow } from '@/common/lib/theme';
import type { SensorSnapshot } from '../types/sensor.types';
import { formatTimestamp } from '../utils/sensor.utils';
import { lab } from './playgroundTheme';
import { SensorStatus } from './SensorStatus';

export function LabButton({ label, onPress, disabled, danger, secondary, testID }: {
  label: string; onPress: () => void; disabled?: boolean; danger?: boolean; secondary?: boolean; testID?: string;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      tone="dark"
      size="medium"
      variant={danger ? 'destructive' : secondary ? 'subtle' : 'primary'}
      testID={testID}
      accessibilityLabel={label}
    />
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
  card: {
    backgroundColor: lab.card,
    borderColor: lab.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 20,
    gap: 16,
    flex: 1,
    boxShadow: Shadow.sm,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: { color: lab.accent, fontFamily: lab.fontMedium, fontSize: 11, letterSpacing: 1.2 },
  heading: { gap: 6 },
  title: { color: lab.text, fontFamily: lab.fontSemiBold, fontSize: 20, lineHeight: 28 },
  description: { color: lab.muted, fontFamily: lab.font, fontSize: 13, lineHeight: 19 },
  permissions: { gap: 4 },
  meta: { color: lab.muted, fontFamily: lab.fontMedium, fontSize: 11 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: lab.red, backgroundColor: lab.errorBg, padding: 12, borderRadius: Radius.sm, fontFamily: lab.font, fontSize: 13, lineHeight: 19 },
  notice: { color: lab.green, backgroundColor: lab.noticeBg, padding: 14, borderRadius: Radius.sm, fontFamily: lab.fontSemiBold, letterSpacing: 0.4 },
  footer: { color: lab.muted, fontFamily: lab.fontMedium, fontSize: 10, lineHeight: 15 },
});
