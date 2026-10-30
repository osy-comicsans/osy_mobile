import { useFonts } from 'expo-font';
import { DefaultTheme, LocaleProvider, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/common/components/animated-icon';
import { directionReady, getLanguage } from '@/common/lib/i18n/i18n';
import { isRtl } from '@/common/lib/i18n/languages';
import { AppProviders } from '@/common/providers/AppProviders';
import { Colors, FontFamily } from '@/common/lib/theme';
import { AlertProvider } from '@/features/alerts/providers/AlertProvider';
import { CrashDetectionProvider } from '@/features/crash-detection/providers/CrashDetectionProvider';
import { LocationProvider } from '@/features/location/providers/LocationProvider';
import { CheckInProvider } from '@/features/safety/providers/CheckInProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Keeps the tabs beneath a modal that was opened directly from a deep link.
export const unstable_settings = {
  anchor: '(tabs)',
};

const OsyLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    notification: Colors.error,
  },
  fonts: {
    regular: { fontFamily: FontFamily.regular, fontWeight: '400' as const },
    medium: { fontFamily: FontFamily.medium, fontWeight: '500' as const },
    bold: { fontFamily: FontFamily.semiBold, fontWeight: '600' as const },
    heavy: { fontFamily: FontFamily.bold, fontWeight: '700' as const },
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Gabarito_400Regular: require('@/assets/fonts/Gabarito_400Regular.ttf'),
    Gabarito_500Medium: require('@/assets/fonts/Gabarito_500Medium.ttf'),
    Gabarito_600SemiBold: require('@/assets/fonts/Gabarito_600SemiBold.ttf'),
    Gabarito_700Bold: require('@/assets/fonts/Gabarito_700Bold.ttf'),
    IBMPlexSansArabic_400Regular: require('@/assets/fonts/IBMPlexSansArabic_400Regular.ttf'),
    IBMPlexSansArabic_500Medium: require('@/assets/fonts/IBMPlexSansArabic_500Medium.ttf'),
    IBMPlexSansArabic_600SemiBold: require('@/assets/fonts/IBMPlexSansArabic_600SemiBold.ttf'),
    IBMPlexSansArabic_700Bold: require('@/assets/fonts/IBMPlexSansArabic_700Bold.ttf'),
  });
  const ready = (loaded || !!error) && directionReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={OsyLightTheme}>
      <AppProviders>
        <LocationProvider>
          <CrashDetectionProvider>
            <StatusBar style="dark" />
            <AnimatedSplashOverlay />
            <CheckInProvider>
              <AlertProvider>
                <LocaleProvider direction={isRtl(getLanguage()) ? 'rtl' : 'ltr'}>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="check-in"
                      options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
                    />
                    <Stack.Screen name="report-accident" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="alert/[id]" options={{ presentation: 'modal' }} />
                  </Stack>
                </LocaleProvider>
              </AlertProvider>
            </CheckInProvider>
          </CrashDetectionProvider>
        </LocationProvider>
      </AppProviders>
    </ThemeProvider>
  );
}
