import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/common/components/themed-text';
import { Card } from '@/common/components/ui/card';
import { Space } from '@/common/lib/theme';

import { useCurrentLocation, useCurrentSpeed, useDrivingState } from '../hooks/useLocation';

const drivingLabels = { stationary: 'Stationary', walking: 'Walking', driving: 'Driving' } as const;

export function LiveLocationCard() {
  const fix = useCurrentLocation();
  const speed = useCurrentSpeed();
  const drivingState = useDrivingState();
  if (!fix) return null;

  return (
    <Card style={styles.card}>
      <View accessible accessibilityLabel={`Speed ${speed === null ? 'unknown' : `${Math.round(speed)} kilometres per hour`}`}>
        <ThemedText type="display">{speed === null ? '--' : Math.round(speed)}</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">km/h</ThemedText>
      </View>
      <ThemedText type="bodyMedium">{drivingLabels[drivingState]}</ThemedText>
      <ThemedText type="label" themeColor="textSecondary">
        {fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', alignItems: 'center', gap: Space[2] },
});
