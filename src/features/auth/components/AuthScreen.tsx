import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { Icon } from '@/common/components/ui/icon';
import { useOnline } from '@/common/hooks/use-online';
import { Colors, MaxContentWidth, Palette, Radius, Shadow, Space } from '@/common/lib/theme';

import { FormNotice } from './FormNotice';
import { useTheme } from '@/common/hooks/use-theme';

// DESIGN.md §2: the primary brand gradient, for heroes and banners only. The hero
// also has a solid accent fill, so its white text stays readable if this is not drawn.
const brandGradient = 'linear-gradient(135deg, #8B4BEA 0%, #6316DB 100%)';
const heroGradient = Platform.OS === 'web'
  ? ({ backgroundImage: brandGradient } as object)
  : { experimental_backgroundImage: brandGradient };

type AuthScreenProps = PropsWithChildren<{
  title: string;
  description?: string;
  overline?: string;
  showBack?: boolean;
  onBack?: () => void;
  footer?: ReactNode;
}>;

function BrandMark() {
  return (
    <View style={styles.brand}>
      <View style={styles.mark}>
        <View style={styles.markDot} />
      </View>
      <ThemedText type="heading" style={styles.brandName}>OSY</ThemedText>
    </View>
  );
}

export function AuthScreen({ title, description, overline, showBack, onBack, footer, children }: AuthScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const online = useOnline();
  const { top, bottom } = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottom + Space[6] }]}>
        <View style={[styles.hero, heroGradient, { paddingTop: top + Space[4] }]}>
          <View style={styles.heroBar}>
            {showBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('auth.back')}
                hitSlop={8}
                onPress={onBack ?? (() => router.back())}
                style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
                <Icon name="back" size={18} color={Colors.onAccent} />
              </Pressable>
            ) : <BrandMark />}
          </View>
          <View style={styles.heroText}>
            {overline && <ThemedText type="overline" style={styles.overline}>{overline}</ThemedText>}
            <ThemedText type="title" accessibilityRole="header" style={styles.title}>{title}</ThemedText>
            {description && <ThemedText type="body" style={styles.description}>{description}</ThemedText>}
          </View>
        </View>

        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          {!online && <FormNotice tone="warning" message={t('auth.offline')} />}
          {children}
        </View>
        {footer && <View style={styles.footer}>{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const SHEET_OVERLAP = 32;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Space[6],
    paddingBottom: SHEET_OVERLAP + Space[8],
    borderBottomStartRadius: Radius.xxl,
    borderBottomEndRadius: Radius.xxl,
    gap: Space[6],
  },
  heroBar: { minHeight: 36, flexDirection: 'row', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  mark: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 5,
    borderColor: Colors.onAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Palette.purple[200] },
  brandName: { color: Colors.onAccent },
  back: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  backPressed: { backgroundColor: 'rgba(255,255,255,0.3)' },
  heroText: { gap: Space[2], maxWidth: MaxContentWidth },
  overline: { color: Palette.purple[200] },
  title: { color: Colors.onAccent },
  description: { color: Palette.purple[100] },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    marginTop: -SHEET_OVERLAP,
    paddingHorizontal: Space[4],
    gap: Space[5],
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[1],
    paddingTop: Space[4],
    paddingHorizontal: Space[6],
  },
});

export const sheetCard = {
  backgroundColor: Colors.surface,
  borderRadius: Radius.xxl,
  padding: Space[6],
  gap: Space[5],
  boxShadow: Shadow.soft,
} as const;
