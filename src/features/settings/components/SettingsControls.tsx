import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { useTheme } from '@/common/hooks/use-theme';
import { Radius, Space } from '@/common/lib/theme';

export function SettingsGroup({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return <Card glass style={styles.group}>
    <ThemedText type="heading" accessibilityRole="header">{title}</ThemedText>
    {description ? <ThemedText type="label" themeColor="textSecondary">{description}</ThemedText> : null}
    {children}
  </Card>;
}
export function ToggleRow({ label, detail, value, disabled, onChange }: { label: string; detail?: string; value: boolean; disabled?: boolean; onChange(value: boolean): void }) {
  const theme = useTheme();
  return <View style={styles.row}>
    <View style={styles.label}><ThemedText type="bodyMedium">{label}</ThemedText>
      {detail ? <ThemedText type="small" themeColor="textSecondary">{detail}</ThemedText> : null}</View>
    <Switch value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={label}
      trackColor={{ false: theme.borderStrong, true: theme.accent }} thumbColor={theme.surface} />
  </View>;
}
export function ChoiceRow<T extends string | number>({ label, value, options, disabled, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; disabled?: boolean; onChange(value: T): void;
}) {
  const theme = useTheme();
  return <View style={styles.choices}>
    <ThemedText type="label" themeColor="textSecondary">{label}</ThemedText>
    <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === value, disabled }}
        disabled={disabled} onPress={() => onChange(option.value)} style={[styles.pill, { borderColor: option.value === value ? theme.accent : theme.border,
          backgroundColor: option.value === value ? theme.accentSoft : theme.surface }]}>
        <ThemedText type="label" themeColor={option.value === value ? 'accent' : 'textSecondary'}>{option.label}</ThemedText>
      </Pressable>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({ group: { gap: Space[4] }, row: { flexDirection: 'row', alignItems: 'center', gap: Space[4], minHeight: 48 },
  label: { flex: 1, gap: Space[1] }, choices: { gap: Space[2] }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  pill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Space[4], paddingVertical: Space[2], borderRadius: Radius.full, borderWidth: 1 } });
