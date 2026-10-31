import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon, type IconName } from '@/common/components/ui/icon';
import { Colors, Palette, Radius, Space } from '@/common/lib/theme';

interface SourceOptionProps {
  icon: IconName;
  title: string;
  description: string;
  // The featured option is the recommended one, with tips under it. Rows sit in a list.
  variant: 'featured' | 'row';
  tips?: string[];
  disabled?: boolean;
  onPress: () => void;
}

export function SourceOption({ icon, title, description, variant, tips = [], disabled, onPress }: SourceOptionProps) {
  const featured = variant === 'featured';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        featured ? styles.featured : styles.row,
        pressed && (featured ? styles.featuredPressed : styles.rowPressed),
        disabled && styles.disabled,
      ]}>
      <View style={styles.head}>
        <View style={featured ? styles.featuredTile : styles.tile}>
          <Icon name={icon} size={featured ? 22 : 20} color={featured ? Colors.onAccent : Colors.accent} />
        </View>
        <View style={styles.text}>
          <ThemedText type="headingS">{title}</ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={featured && styles.featuredDescription}>
            {description}
          </ThemedText>
        </View>
        <Icon name="forward" size={18} color={featured ? Colors.accent : Colors.textTertiary} />
      </View>
      {featured && tips.length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.tips}>
            {tips.map((tip) => (
              <View key={tip} style={styles.tip}>
                <Icon name="check" size={16} color={Colors.accent} />
                <ThemedText type="body" style={styles.tipText}>{tip}</ThemedText>
              </View>
            ))}
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  featured: {
    gap: Space[3],
    padding: Space[4],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.backgroundElement,
  },
  featuredPressed: { backgroundColor: Colors.accentSoft },
  row: { paddingHorizontal: Space[4], paddingVertical: Space[3] },
  rowPressed: { backgroundColor: Colors.backgroundElement },
  disabled: { opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  featuredTile: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  text: { flex: 1 },
  featuredDescription: { color: Palette.neutral[600] },
  divider: { height: 1, backgroundColor: Palette.purple[200] },
  tips: { gap: Space[2] },
  tip: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  tipText: { flex: 1, color: Palette.neutral[600] },
});
