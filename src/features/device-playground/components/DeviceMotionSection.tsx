import { Text, View } from 'react-native';

import { useDeviceMotion } from '../hooks/useDeviceMotion';
import { formatNumber, orientationLabel } from '../utils/sensor.utils';
import { AxisVisualizer } from './AxisVisualizer';
import { OrientationIndicator } from './OrientationIndicator';
import { SensorCard } from './SensorCard';
import { SensorValue } from './SensorValue';
import { sectionStyles as styles } from './sectionStyles';

export function DeviceMotionSection() {
  const sensor = useDeviceMotion();
  const data = sensor.data;
  const rate = data?.rotationRate;
  const rotation = data?.rotation;
  return (
    <SensorCard title="Device motion" tag="04 / IMU" description="Compare fused acceleration, gravity, attitude, and rotation rate."
      state={sensor} onStart={sensor.start} onStop={sensor.stop}>
      <OrientationIndicator rotation={rotation} />
      <View style={styles.values}>
        <SensorValue label="Screen orientation" value={orientationLabel(data?.orientation)} />
        <SensorValue label="Reported interval" value={formatNumber(data?.interval, 0)} unit="ms" />
      </View>
      <Text style={styles.label}>ACCELERATION · WITHOUT GRAVITY</Text>
      <AxisVisualizer vector={data?.acceleration} range={20} unit="m/s²" />
      <Text style={styles.label}>ACCELERATION · WITH GRAVITY</Text>
      <AxisVisualizer vector={data?.accelerationIncludingGravity} range={20} unit="m/s²" />
      <Text style={styles.label}>ROTATION RATE · SDK α / β / γ</Text>
      <AxisVisualizer vector={{ x: rate?.alpha, y: rate?.beta, z: rate?.gamma }} labels={['α', 'β', 'γ']} range={180} unit="°/s" />
      <View style={styles.values}>
        <SensorValue label="Rotation α · Z" value={formatNumber(rotation?.alpha)} unit="rad" />
        <SensorValue label="Rotation β · X" value={formatNumber(rotation?.beta)} unit="rad" />
        <SensorValue label="Rotation γ · Y" value={formatNumber(rotation?.gamma)} unit="rad" />
      </View>
      <Text style={styles.hint}>A dash means the device did not provide that field. Screen orientation respects the app’s portrait lock; attitude still responds to tilt. Rotation-rate α/β/γ labels are kept as reported by the SDK.</Text>
    </SensorCard>
  );
}
