import '@/common/lib/startup/nativeSplash';

import { DefaultTheme, LocaleProvider, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

import { StartupSplash } from '@/common/components/StartupSplash';
import { useStartup } from '@/common/hooks/use-startup';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { isRtl } from '@/common/lib/i18n/languages';
import { isEmergencyPath } from '@/common/lib/startup/startupCoordinator';
import { AppProviders } from '@/common/providers/AppProviders';
import { FontReadinessProvider } from '@/common/providers/FontReadinessProvider';
import { Colors, FontFamily } from '@/common/lib/theme';
import { AlertProvider } from '@/features/alerts/providers/AlertProvider';
import { accountService } from '@/features/auth/authServices';
import { useAccount } from '@/features/auth/hooks/useAccount';
import { CrashDetectionProvider } from '@/features/crash-detection/providers/CrashDetectionProvider';
import { LocationProvider } from '@/features/location/providers/LocationProvider';
import { DrivingModeProvider } from '@/features/driving/providers/DrivingModeProvider';
import { AreaProvider } from '@/features/location/providers/AreaProvider';
import { RoadProvider } from '@/features/roads/providers/RoadProvider';
import { CheckInProvider } from '@/features/safety/providers/CheckInProvider';

// Keeps the tabs beneath a modal that was opened directly from a deep link.
export const unstable_settings = {
  anchor: '(tabs)',
};

// Temporary Home preview: set to false to restore login in development.
// Release builds always keep the normal account gate.
const SKIP_LOGIN_FOR_HOME_PREVIEW = __DEV__;

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
  const { startup, snapshot, path } = useStartup();
  const { phase } = useAccount();
  const canAccessApp = SKIP_LOGIN_FOR_HOME_PREVIEW || phase === 'ready';
  const tone = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [dismissed, setDismissed] = useState(false);
  const handleDismiss = useCallback(() => setDismissed(true), []);
  const emergency = snapshot.emergency || isEmergencyPath(path);

  useEffect(() => accountService.start(), []);

  return (
    <ThemeProvider value={OsyLightTheme}>
      <FontReadinessProvider ready={snapshot.tasks.fonts === 'ready'}>
        <AppProviders>
          <DrivingModeProvider>
            <LocationProvider>
              <AreaProvider>
                <RoadProvider>
                  <CrashDetectionProvider>
                    <StatusBar style={!dismissed && !emergency && tone === 'dark' ? 'light' : 'dark'} />
                    <View style={styles.root} onLayout={startup.markContentReady}>
                      <View style={styles.root} accessibilityElementsHidden={!dismissed && !emergency}
                        importantForAccessibility={!dismissed && !emergency ? 'no-hide-descendants' : 'auto'}>
                        <CheckInProvider>
                          <AlertProvider>
                            <LocaleProvider direction={isRtl(getLanguage()) ? 'rtl' : 'ltr'}>
                              <Stack screenOptions={{ headerShown: false }}>
                                <Stack.Protected guard={canAccessApp} redirectTo="/login">
                                  <Stack.Screen name="(tabs)" />
                                  <Stack.Screen name="report-accident" options={{ presentation: 'modal' }} />
                                </Stack.Protected>
                                <Stack.Protected guard={!canAccessApp}>
                                  <Stack.Screen name="(auth)" />
                                </Stack.Protected>
                                <Stack.Screen
                                  name="check-in"
                                  options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
                                />
                                <Stack.Screen name="alert/[id]" options={{ presentation: 'modal' }} />
                              </Stack>
                            </LocaleProvider>
                          </AlertProvider>
                        </CheckInProvider>
                      </View>
                      <StartupSplash snapshot={snapshot} emergency={emergency} tone={tone}
                        onArtworkReady={startup.markArtworkReady} onDismiss={handleDismiss} />
                    </View>
                  </CrashDetectionProvider>
                </RoadProvider>
              </AreaProvider>
            </LocationProvider>
          </DrivingModeProvider>
        </AppProviders>
      </FontReadinessProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.background } });
