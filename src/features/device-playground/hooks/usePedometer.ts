import { useState } from 'react';

import { createPedometerDriver } from '../native/sensorDrivers';
import { useSensorSession } from './useSensorSession';

export function usePedometer() {
  const [test] = useState(createPedometerDriver);
  const sensor = useSensorSession('pedometer', test.driver);
  return { ...sensor, reset() { sensor.session.replaceData(test.reset()); } };
}
