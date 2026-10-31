import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, Radius, Space, Typography } from '@/common/lib/theme';

// The check-in works without an account, so it stays reachable before sign-in.
export function EmergencyAccess({ variant }: { variant: 'card' | 'link' }) {
  const { t } = useTranslation();
  const theme = useTheme();

  const open = () => router.push('/check-in');

  if (variant === 'link') {
    return (
      <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        <Icon name="phone" size={18} color={Colors.errorText} />
        <ThemedText style={[Typography.bodyStrong, styles.title]}>{t('auth.emergencyLink')}</ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('auth.emergencyHint')}
      onPress={open}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.surface }, pressed && styles.cardPressed]}>
      <View style={styles.badge}><Icon name="phone" size={18} color={Colors.onAccent} /></View>
      <View style={styles.text}>
        <ThemedText style={[Typography.bodyStrong, styles.title]}>{t('auth.emergencyTitle')}</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">{t('auth.emergencyHint')}</ThemedText>
      </View>
      <Icon name="forward" size={18} color={Colors.errorText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.errorSoft,
  },
  cardPressed: { borderColor: Colors.error },
  badge: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
  },
  text: { flex: 1 },
  title: { color: Colors.errorText },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    minHeight: 44,
    borderRadius: Radius.full,
  },
  pressed: { backgroundColor: Colors.errorSoft },
});
