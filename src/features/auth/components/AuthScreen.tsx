import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { AnimatedLogo } from '@/common/components/ui/animated-logo';
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
  // Pinned to the bottom of the sheet, below any free space.
  footer?: ReactNode;
}>;

export function AuthScreen({ title, description, logo, progress, showBack, onBack, footer, children }: AuthScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const online = useOnline();
  const { top, bottom } = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={[styles.header, { paddingTop: top + Space[4] }]}>
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

        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: bottom + Space[8] }]}>
          <View style={styles.sheetContent}>
            {!online && <FormNotice tone="warning" message={t('auth.offline')} />}
            {children}
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
  root: { flex: 1, backgroundColor: Colors.accent },
  scroll: { flexGrow: 1 },
  header: {
    paddingHorizontal: Space[6],
    paddingBottom: 28,
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
  sheet: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: Space[6],
    paddingHorizontal: Space[6],
    borderTopStartRadius: Radius.xxl,
    borderTopEndRadius: Radius.xxl,
  },
  sheetContent: { flexGrow: 1, width: '100%', maxWidth: MaxContentWidth, gap: Space[5] },
  spacer: { flexGrow: 1 },
  footer: { gap: Space[5] },
});
