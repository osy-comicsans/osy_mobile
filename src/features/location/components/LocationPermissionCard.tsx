import { Linking, Platform, StyleSheet } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { Card } from '@/common/components/ui/card';
import { Space } from '@/common/lib/theme';

import { useLocationService, useLocationState } from '../hooks/useLocation';

const openSettings = () => { void Linking.openSettings(); };

function useMessage() {
  const { status, location, canAskAgain, motion, error } = useLocationState();

  if (status === 'error') return { title: 'Location unavailable', body: error, action: 'retry' } as const;
  if (status === 'servicesDisabled') {
    return {
      title: 'Location services are off',
      body: 'Turn on location services for your device so OSY can follow your position and speed.',
      action: 'retry',
    } as const;
  }
  if (location === 'undetermined') {
    return {
      title: 'Share your location with OSY',
      body: 'OSY uses your location and speed while the app is open to warn you about road risks. Motion access helps it notice a crash.',
      action: 'request',
    } as const;
  }
  if (location === 'denied') {
    return {
      title: 'Location access is off',
      body: 'OSY cannot show your position or speed without location access.',
      action: canAskAgain ? 'request' : 'settings',
    } as const;
  }
  if (location === 'limited') {
    return {
      title: 'Precise location is off',
      body: 'OSY is using your approximate location, so speed and road details may be wrong.',
      action: 'settings',
    } as const;
  }
  if (motion === 'undetermined') {
    return {
      title: 'Allow motion access',
      body: 'Motion access helps OSY notice a crash. Location still works without it.',
      action: 'request',
    } as const;
  }
  if (motion === 'denied') {
    return {
      title: 'Motion access is off',
      body: 'Location still works, but OSY will not be able to use motion to notice a crash.',
      action: 'settings',
    } as const;
  }
  return null;
}

export function LocationPermissionCard() {
  const service = useLocationService();
  const { requesting } = useLocationState();
  const message = useMessage();
  if (!message) return null;

  const canOpenSettings = message.action === 'settings' && Platform.OS !== 'web';

  return (
    <Card tone="accentSoft" style={styles.card}>
      <ThemedText type="headingS">{message.title}</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">{message.body}</ThemedText>
      {message.action === 'request' && (
        <Button label="Allow access" loading={requesting} onPress={() => void service.requestPermission()} />
      )}
      {message.action === 'retry' && (
        <Button label="Try again" variant="secondary" onPress={() => void service.start()} />
      )}
      {canOpenSettings && <Button label="Open settings" variant="secondary" onPress={openSettings} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: Space[3] },
});
