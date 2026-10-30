import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { Colors, Radius, Space } from '@/common/lib/theme';

export function SideProgress({ side }: { side: 'front' | 'back' }) {
  const { t } = useTranslation();
  const frontDone = side === 'back';

  return (
    <View style={styles.row}>
      <View style={[styles.pill, styles.active]}>
        {frontDone && <Icon name="check" size={14} color={Colors.onAccent} />}
        <ThemedText type="smallBold" style={styles.activeText}>{t('documents.front')}</ThemedText>
      </View>
      <View style={[styles.pill, frontDone ? styles.active : styles.idle]}>
        <ThemedText type="smallBold" style={frontDone ? styles.activeText : styles.idleText}>{t('documents.back')}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Space[2] },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[1],
    minHeight: 36,
    borderRadius: Radius.full,
  },
  active: { backgroundColor: Colors.accent },
  idle: { backgroundColor: Colors.backgroundElement },
  activeText: { color: Colors.onAccent },
  idleText: { color: Colors.textSecondary },
});
