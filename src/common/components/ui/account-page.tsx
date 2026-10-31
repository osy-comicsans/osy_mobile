import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassAppearanceProvider } from '@/common/providers/GlassAppearanceProvider';
import { useTheme } from '@/common/hooks/use-theme';
import { Space, MaxContentWidth } from '@/common/lib/theme';
import { AmbientBackground } from './ambient-background';
import { ThemedText } from '../themed-text';

export function AccountPage({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  const theme = useTheme(); const insets = useSafeAreaInsets();
  return <GlassAppearanceProvider><View style={[styles.root, { backgroundColor: theme.background }]}>
    <AmbientBackground />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Space[8] }]}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <ThemedText type="display" accessibilityRole="header">{title}</ThemedText>
          {description ? <ThemedText type="body" themeColor="textSecondary">{description}</ThemedText> : null}
        </View>
        {children}
      </View>
    </ScrollView>
  </View></GlassAppearanceProvider>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, scroll: { padding: Space[4], alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Space[4] }, heading: { paddingVertical: Space[4], gap: Space[2] } });
