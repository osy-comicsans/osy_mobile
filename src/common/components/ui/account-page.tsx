import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/common/hooks/use-theme';
import { MaxContentWidth, Space } from '@/common/lib/theme';
import { ScreenHero } from './screen-hero';

export function AccountPage({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never" style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: bottom + Space[8] }}>
      <ScreenHero back title={title} description={description} />
      <View style={styles.scroll}><View style={styles.content}>{children}</View></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Space[4], alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Space[4] },
});
