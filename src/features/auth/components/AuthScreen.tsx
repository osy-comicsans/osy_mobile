import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { AmbientBackground } from '@/common/components/ui/ambient-background';
import { useOnline } from '@/common/hooks/use-online';
import { MaxContentWidth, Space } from '@/common/lib/theme';

type AuthScreenProps = PropsWithChildren<{ title: string; description?: string }>;

export function AuthScreen({ title, description, children }: AuthScreenProps) {
  const { t } = useTranslation();
  const online = useOnline();

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safeArea}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <ThemedText type="title" accessibilityRole="header">{title}</ThemedText>
              {description && <ThemedText themeColor="textSecondary">{description}</ThemedText>}
            </View>
            {!online && (
              <ThemedText type="label" themeColor="errorText" accessibilityRole="alert">
                {t('auth.offline')}
              </ThemedText>
            )}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: Space[5],
    padding: Space[6],
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Space[2] },
});
