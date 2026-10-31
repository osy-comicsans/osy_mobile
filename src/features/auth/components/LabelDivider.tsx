import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { useTheme } from '@/common/hooks/use-theme';
import { Space } from '@/common/lib/theme';

export function LabelDivider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
      <ThemedText type="label" themeColor="textSecondary">{label}</ThemedText>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  line: { flex: 1, height: 1 },
});
