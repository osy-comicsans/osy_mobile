import { View } from 'react-native';

import { useGyroscope } from '../hooks/useGyroscope';
import { finite, formatNumber, radiansToDegrees } from '../utils/sensor.utils';
import { AxisVisualizer } from './AxisVisualizer';
import { RotationDial } from './OrientationIndicator';
import { SensorCard } from './SensorCard';
import { SensorValue } from './SensorValue';
import { sectionStyles as styles } from './sectionStyles';

export function GyroscopeSection() {
  const sensor = useGyroscope();
  const data = sensor.data;
  return (
    <SensorCard title="Gyroscope" tag="03 / GYR" description="Angular velocity: how fast the device rotates around each axis."
      state={sensor} onStart={sensor.start} onStop={sensor.stop}>
      <AxisVisualizer vector={data} range={Math.PI} unit="rad/s" />
      <View style={styles.values}>
        {(['x', 'y', 'z'] as const).map((axis) => <SensorValue key={axis} label={`${axis.toUpperCase()} rotation rate`} value={formatNumber(finite(data?.[axis]) ? radiansToDegrees(data[axis]) : null, 1)} unit="°/s" />)}
      </View>
      <RotationDial value={finite(data?.z) ? radiansToDegrees(data.z) : null} label="Z rotation rate" />
    </SensorCard>
  );
}
