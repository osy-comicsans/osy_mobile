import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/common/components/animated-icon';
import { AppProviders } from '@/common/providers/AppProviders';
import { Colors, FontFamily } from '@/common/lib/theme';
import { LocationProvider } from '@/features/location/providers/LocationProvider';

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
  });
  const fontsReady = loaded || !!error;

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <ThemeProvider value={OsyLightTheme}>
      <AppProviders>
        <LocationProvider>
          <StatusBar style="dark" />
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="check-in"
              options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
            />
            <Stack.Screen name="report-accident" options={{ presentation: 'modal' }} />
            <Stack.Screen name="alert/[id]" options={{ presentation: 'modal' }} />
          </Stack>
        </LocationProvider>
      </AppProviders>
    </ThemeProvider>
  );
}
