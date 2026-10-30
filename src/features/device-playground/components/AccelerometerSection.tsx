import { Text } from 'react-native';

import { useAccelerometer } from '../hooks/useAccelerometer';
import { magnitude } from '../utils/sensor.utils';
import { AxisVisualizer, MagnitudeBar } from './AxisVisualizer';
import { SensorCard } from './SensorCard';
import { sectionStyles as styles } from './sectionStyles';

export function AccelerometerSection() {
  const sensor = useAccelerometer();
  return (
    <SensorCard title="Accelerometer" tag="02 / ACC" description="Acceleration along the device’s three axes, including gravity."
      state={sensor} onStart={sensor.start} onStop={sensor.stop}>
      <AxisVisualizer vector={sensor.data} range={2} unit="g" />
      <MagnitudeBar value={magnitude(sensor.data)} />
      <Text style={styles.hint}>X: left → right · Y: bottom → top · Z: through the screen. A stationary device typically measures about 1 g in total.</Text>
    </SensorCard>
  );
}
