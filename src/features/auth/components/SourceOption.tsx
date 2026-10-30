import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon, type IconName } from '@/common/components/ui/icon';
import { Colors, Radius, Shadow, Space } from '@/common/lib/theme';

interface SourceOptionProps {
  icon: IconName;
  title: string;
  description: string;
  disabled?: boolean;
  onPress: () => void;
}

// DESIGN.md §11.3: the template card, used here as a single tappable choice.
export function SourceOption({ icon, title, description, disabled, onPress }: SourceOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, disabled && styles.disabled]}>
      <View style={styles.icon}><Icon name={icon} size={22} color={Colors.accent} /></View>
      <View style={styles.text}>
        <ThemedText type="headingS">{title}</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">{description}</ThemedText>
      </View>
      <Icon name="forward" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    padding: Space[4],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    boxShadow: Shadow.sm,
  },
  pressed: { borderColor: Colors.accent, boxShadow: Shadow.md },
  disabled: { opacity: 0.5 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentSoft,
  },
  text: { flex: 1, gap: 2 },
});
