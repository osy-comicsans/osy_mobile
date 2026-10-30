import { Text, View } from 'react-native';

import { useShakeDetection } from '../hooks/useShakeDetection';
import { MagnitudeBar } from './AxisVisualizer';
import { SensorCard, LabButton } from './SensorCard';
import { SensitivitySlider } from './SensitivitySlider';
import { sectionStyles as styles } from './sectionStyles';

export function ShakeSection() {
  const sensor = useShakeDetection();
  return (
    <SensorCard title="Shake detection" tag="05 / SHAKE" description="An independent accelerometer listener detects sudden movement above a threshold."
      state={sensor} onStart={sensor.start} onStop={sensor.stop}
      controls={<LabButton label="Reset shakes" onPress={sensor.reset} secondary disabled={sensor.phase === 'starting'} />}>
      <View style={styles.countPanel}>
        <Text style={styles.label}>DETECTED SHAKES</Text>
        <Text style={styles.count}>{sensor.data?.count ?? 0}</Text>
      </View>
      <MagnitudeBar value={sensor.data?.magnitude} threshold={sensor.threshold} />
      <SensitivitySlider value={sensor.threshold} onChange={sensor.setThreshold} />
      <Text style={styles.hint}>This test does not start the Accelerometer card. Each has its own Start/Stop state and subscription.</Text>
    </SensorCard>
  );
}
