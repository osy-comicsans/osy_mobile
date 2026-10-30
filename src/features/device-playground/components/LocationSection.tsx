import { View, Text } from 'react-native';

import { useLocationTracking } from '../hooks/useLocationTracking';
import { finite, formatNumber, formatTimestamp, headingDirection, speedKmh } from '../utils/sensor.utils';
import { RotationDial } from './OrientationIndicator';
import { SensorCard, LabButton } from './SensorCard';
import { SensorValue } from './SensorValue';
import { sectionStyles as styles } from './sectionStyles';

export function LocationSection() {
  const sensor = useLocationTracking();
  const coords = sensor.data?.coords;
  const speed = finite(coords?.speed) && coords.speed >= 0 ? coords.speed : null;
  const heading = finite(coords?.heading) && coords.heading >= 0 ? coords.heading : null;
  const accuracy = finite(coords?.accuracy) && coords.accuracy >= 0 ? coords.accuracy : null;
  return (
    <SensorCard title="GPS & location" tag="01 / GPS" description="Inspect a live foreground GPS fix, its accuracy, and course of travel."
      state={sensor} onStart={sensor.start} onStop={sensor.stop}
      controls={<LabButton label={sensor.refreshing ? 'Getting a fix…' : 'Refresh location'} onPress={sensor.refresh} secondary disabled={sensor.refreshing || sensor.phase === 'starting'} />}>
      <View style={styles.values}>
        <SensorValue label="Latitude" value={formatNumber(coords?.latitude, 6)} unit="°" />
        <SensorValue label="Longitude" value={formatNumber(coords?.longitude, 6)} unit="°" />
        <SensorValue label="Altitude" value={formatNumber(coords?.altitude, 1)} unit="m" />
        <SensorValue label="Horizontal accuracy" value={formatNumber(accuracy, 1)} unit="m" />
        <SensorValue label="Speed" value={formatNumber(speed, 2)} unit="m/s" />
        <SensorValue label="Speed" value={formatNumber(speedKmh(speed), 2)} unit="km/h" />
        <SensorValue label="Direction" value={headingDirection(heading)} />
        <SensorValue label="Fix timestamp (UTC)" value={formatTimestamp(sensor.data?.timestamp)} wide />
      </View>
      <RotationDial value={heading} label="GPS course / heading" compass />
      <Text style={styles.hint}>Heading is the location provider’s course, not a compass bearing. Speed and heading can be unavailable while stationary. A refresh gets one fix without starting tracking.</Text>
    </SensorCard>
  );
}
