import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { Colors, Palette, Radius, Space, Typography } from '@/common/lib/theme';

const tones = {
  error: { background: Colors.errorSoft, color: Colors.errorText, icon: 'error' },
  warning: { background: Colors.warningSoft, color: Colors.warning, icon: 'warning' },
} as const;

// `detail` says what to do next, under the message.
export function FormNotice({ message, detail, tone = 'error' }: { message: string; detail?: string; tone?: keyof typeof tones }) {
  const { background, color, icon } = tones[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: background }]}>
      <View style={styles.icon}><Icon name={icon} size={20} color={color} /></View>
      <View style={styles.text}>
        <ThemedText style={[Typography.bodyStrong, styles.message]}>{message}</ThemedText>
        {detail && <ThemedText type="body" style={styles.detail}>{detail}</ThemedText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space[3],
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    borderRadius: Radius.md,
  },
  icon: { paddingTop: 1 },
  text: { flex: 1, gap: 2 },
  message: { color: Colors.textPrimary },
  detail: { color: Palette.neutral[600] },
});
