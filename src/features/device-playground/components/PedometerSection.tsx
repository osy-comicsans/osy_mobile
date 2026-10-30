import { Text, View } from 'react-native';

import { usePedometer } from '../hooks/usePedometer';
import { MagnitudeBar } from './AxisVisualizer';
import { SensorCard, LabButton } from './SensorCard';
import { SensorValue } from './SensorValue';
import { sectionStyles as styles } from './sectionStyles';

export function PedometerSection() {
  const sensor = usePedometer();
  return (
    <SensorCard title="Pedometer" tag="06 / STEP" description="Count steps delivered during this foreground test, with no historical health queries."
      state={sensor} onStart={sensor.start} onStop={sensor.stop}
      controls={<LabButton label="Reset step session" onPress={sensor.reset} secondary disabled={sensor.phase === 'starting'} />}>
      <View style={styles.countPanel}>
        <Text style={styles.label}>CURRENT TEST SESSION</Text>
        <Text style={styles.count}>{sensor.data?.steps ?? 0}</Text>
        <Text style={styles.hint}>steps recorded since Start or Reset</Text>
      </View>
      <SensorValue label="Raw steps reported by the subscription" value={sensor.data?.rawSteps ?? '—'} unit="steps" />
      <MagnitudeBar value={sensor.data?.steps} max={20} label="Session progress" unit="steps" />
      <Text style={styles.hint}>Walk with a supported physical device to receive updates. Events can be delayed. Start begins a new test; Reset rebases the counter without adding a second listener.</Text>
    </SensorCard>
  );
}
