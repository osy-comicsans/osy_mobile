import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { Colors, Radius, Space } from '@/common/lib/theme';

const tones = {
  error: { background: Colors.errorSoft, color: Colors.errorText, icon: 'error' },
  warning: { background: Colors.warningSoft, color: Colors.warning, icon: 'warning' },
} as const;

export function FormNotice({ message, tone = 'error' }: { message: string; tone?: keyof typeof tones }) {
  const { background, color, icon } = tones[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: background }]}>
      <Icon name={icon} size={18} color={color} />
      <ThemedText type="label" style={styles.text}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    padding: Space[3],
    borderRadius: Radius.md,
  },
  text: { flex: 1, color: Colors.textPrimary },
});
