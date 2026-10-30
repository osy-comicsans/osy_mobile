import { loadAsync } from 'expo-font';
import * as Linking from 'expo-linking';
import { usePathname } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { authSession } from '@/common/lib/api/axios';
import { directionReady } from '@/common/lib/i18n/i18n';
import { StartupCoordinator } from '@/common/lib/startup/startupCoordinator';

export function useStartup() {
  const path = usePathname();
  const [startup] = useState(() => new StartupCoordinator({
    fonts: () => loadAsync({
      Gabarito_400Regular: require('@/assets/fonts/Gabarito_400Regular.ttf'),
      Gabarito_500Medium: require('@/assets/fonts/Gabarito_500Medium.ttf'),
      Gabarito_600SemiBold: require('@/assets/fonts/Gabarito_600SemiBold.ttf'),
      Gabarito_700Bold: require('@/assets/fonts/Gabarito_700Bold.ttf'),
      IBMPlexSansArabic_400Regular: require('@/assets/fonts/IBMPlexSansArabic_400Regular.ttf'),
      IBMPlexSansArabic_500Medium: require('@/assets/fonts/IBMPlexSansArabic_500Medium.ttf'),
      IBMPlexSansArabic_600SemiBold: require('@/assets/fonts/IBMPlexSansArabic_600SemiBold.ttf'),
      IBMPlexSansArabic_700Bold: require('@/assets/fonts/IBMPlexSansArabic_700Bold.ttf'),
    }),
    session: () => authSession.restore(),
    // A successful direction change restarts JS. If the restart stalls, the
    // coordinator's deadline reveals the app instead of returning null forever.
    direction: () => directionReady ? Promise.resolve() : new Promise<void>(() => {}),
  }, path));
  const snapshot = useSyncExternalStore(startup.subscribe, startup.getSnapshot, startup.getSnapshot);

  useEffect(() => {
    let active = true;
    startup.start();
    const subscription = Linking.addEventListener('url', ({ url }) => startup.prioritizeEmergency(url));
    void Linking.getInitialURL().then((url) => { if (active) startup.prioritizeEmergency(url); }, () => undefined);
    return () => { active = false; subscription.remove(); startup.stop(); };
  }, [startup]);
  useEffect(() => { startup.prioritizeEmergency(path); }, [path, startup]);
  return { startup, snapshot, path };
}
