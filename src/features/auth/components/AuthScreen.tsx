import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { AnimatedLogo } from '@/common/components/ui/animated-logo';
import { Card } from '@/common/components/ui/card';
import { Icon } from '@/common/components/ui/icon';
import { useOnline } from '@/common/hooks/use-online';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, MaxContentWidth, Palette, Radius, Space, Typography } from '@/common/lib/theme';

import { FormNotice } from './FormNotice';
import { SignupProgress, type SignupStep } from './SignupProgress';

type AuthScreenProps = PropsWithChildren<{
  title: string;
  description?: string;
  logo?: boolean;
  progress?: SignupStep;
  showBack?: boolean;
  onBack?: () => void;
  // Pinned to the bottom, below any free space.
  footer?: ReactNode;
  // Sections bring their own cards, so the content is not wrapped in one.
  bare?: boolean;
}>;

export function AuthScreen({ title, description, logo, progress, showBack, onBack, footer, bare, children }: AuthScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const online = useOnline();
  const { top, bottom } = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={[styles.header, { paddingTop: top + Space[4] }]}>
          {/* The step bar fills the top row, so the road would sit on its labels. */}
          {!progress && (
            <Image source={require('@/assets/brand/osy-road-motif.png')} contentFit="contain" transition={0}
              accessible={false} style={styles.road} />
          )}
          <View style={styles.headerContent}>
            {(showBack || logo || progress) && (
              <View style={styles.topRow}>
                {showBack && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('auth.back')}
                    onPress={onBack ?? (() => router.back())}
                    style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
                    <Icon name="back" size={20} color={Colors.onAccent} />
                  </Pressable>
                )}
                {logo && <AnimatedLogo still width={84} emblemColor={Colors.onAccent} lettersColor={Colors.onAccent} />}
                {progress && <SignupProgress {...progress} />}
              </View>
            )}
            <View style={styles.headerText}>
              <ThemedText accessibilityRole="header" style={[Typography.displayS, styles.title]}>{title}</ThemedText>
              {description && <ThemedText style={[Typography.bodyLarge, styles.description]}>{description}</ThemedText>}
            </View>
          </View>
        </View>

        <View style={[styles.body, { paddingBottom: bottom + Space[6] }]}>
          <View style={styles.bodyContent}>
            {!online && <FormNotice tone="warning" message={t('auth.offline')} />}
            {bare ? children : <Card style={styles.card}>{children}</Card>}
            {footer && (
              <>
                <View style={styles.spacer} />
                <View style={styles.footer}>{footer}</View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  // The same purple hero as the rest of the app, rounded at the bottom.
  header: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Space[5],
    paddingBottom: Space[8],
    borderBottomStartRadius: Radius.xxl,
    borderBottomEndRadius: Radius.xxl,
    overflow: 'hidden',
    alignItems: 'center',
  },
  // Kept to the top corner, clear of the title below it.
  road: { position: 'absolute', end: -44, top: 8, width: 230, height: 143 },
  headerContent: { width: '100%', maxWidth: MaxContentWidth, gap: Space[6] },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Space[4] },
  back: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.purple[600],
  },
  backPressed: { backgroundColor: Palette.purple[700] },
  headerText: { gap: 6 },
  title: { color: Colors.onAccent },
  description: { color: Palette.purple[100] },
  body: { flexGrow: 1, alignItems: 'center', paddingTop: Space[5], paddingHorizontal: Space[4] },
  bodyContent: { flexGrow: 1, width: '100%', maxWidth: MaxContentWidth, gap: Space[4] },
  card: { gap: Space[5] },
  spacer: { flexGrow: 1 },
  footer: { gap: Space[5] },
});
