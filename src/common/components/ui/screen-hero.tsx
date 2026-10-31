import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Palette, Radius, Space, Typography } from '@/common/lib/theme';
import { ThemedText } from '../themed-text';
import { AnimatedLogo } from './animated-logo';
import { Icon } from './icon';

// The brand board's purple field and winding road. Every main screen opens with it.
export function ScreenHero({ title, description, back = false, children }: PropsWithChildren<{
  title?: string; description?: string; back?: boolean;
}>) {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { paddingTop: top + Space[3] }]}>
      <Image source={require('@/assets/brand/osy-road-motif.png')} contentFit="contain" transition={0}
        accessible={false} style={styles.road} />
      <View style={styles.content}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('auth.back')} hitSlop={8}
            onPress={() => router.back()} style={styles.back}>
            <Icon name="back" size={18} color={Colors.onAccent} />
          </Pressable>
        ) : <AnimatedLogo still width={84} emblemColor={Colors.onAccent} lettersColor={Colors.onAccent} />}
        {title ? <ThemedText accessibilityRole="header" style={[Typography.displayS, styles.title]}>{title}</ThemedText> : null}
        {description ? <ThemedText type="body" style={styles.description}>{description}</ThemedText> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Palette.purple[500],
    paddingHorizontal: Space[4],
    paddingBottom: Space[6],
    borderBottomStartRadius: Radius.xxl,
    borderBottomEndRadius: Radius.xxl,
    overflow: 'hidden',
    alignItems: 'center',
  },
  // Kept to the top corner, clear of the name and readings below it.
  road: { position: 'absolute', end: -44, top: 8, width: 230, height: 143 },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Space[3] },
  title: { color: Colors.onAccent, marginTop: Space[2] },
  description: { color: Palette.purple[100] },
  back: {
    width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.purple[600],
  },
});
