import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/common/components/themed-text';
import { AnimatedLogo } from '@/common/components/ui/animated-logo';
import { Button } from '@/common/components/ui/button';
import { useTheme } from '@/common/hooks/use-theme';
import { Colors, MaxContentWidth, Palette, Radius, Space, Typography } from '@/common/lib/theme';

import { EmergencyAccess } from '../components/EmergencyAccess';
import { LanguageSwitch } from '../components/LanguageSwitch';

export function WelcomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { top, bottom } = useSafeAreaInsets();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <StatusBar style="light" />
      <View style={[styles.hero, { paddingTop: top + 28 }]}>
        <Image source={require('@/assets/brand/osy-road-motif.png')} contentFit="contain" transition={0}
          accessible={false} style={styles.road} />
        <View style={styles.heroContent}>
          <AnimatedLogo width={132} emblemColor={Colors.onAccent} lettersColor={Colors.onAccent} />
          <View style={styles.headline}>
            <ThemedText accessibilityRole="header" style={[Typography.displayM, styles.title]}>
              {t('auth.welcomeTitle')}
            </ThemedText>
            <ThemedText style={[Typography.bodyLarge, styles.description]}>{t('auth.welcomeDescription')}</ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: bottom + Space[8] }]}>
        <View style={styles.sheetContent}>
          <LanguageSwitch />
          <Button label={t('auth.createAccount')} size="large" onPress={() => router.push('/register')} />
          <Button label={t('auth.signIn')} variant="tonal" size="large" onPress={() => router.push('/login')} />
          <EmergencyAccess variant="card" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.accent },
  scroll: { flexGrow: 1 },
  hero: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingBottom: 28, overflow: 'hidden' },
  road: { position: 'absolute', start: -30, top: 40, width: 470, height: 291 },
  heroContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    justifyContent: 'space-between',
    gap: Space[12],
  },
  headline: { gap: Space[2] },
  title: { color: Colors.onAccent },
  description: { color: Palette.purple[100] },
  sheet: {
    alignItems: 'center',
    paddingTop: Space[6],
    paddingHorizontal: Space[6],
    borderTopStartRadius: Radius.xxl,
    borderTopEndRadius: Radius.xxl,
  },
  sheetContent: { width: '100%', maxWidth: MaxContentWidth, gap: Space[3] },
});
