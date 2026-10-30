import { useEffect, useState } from 'react';

import { createShakeDriver } from '../native/sensorDrivers';
import { clamp } from '../utils/sensor.utils';
import { useSensorSession } from './useSensorSession';

export function useShakeDetection() {
  const [test] = useState(createShakeDriver);
  const [threshold, setThreshold] = useState(2.2);
  const sensor = useSensorSession('shake', test.driver);
  const detectedAt = sensor.data?.detectedAt;
  useEffect(() => {
    if (detectedAt && Date.now() - detectedAt < 1_200 && sensor.session.getSnapshot().phase === 'running') sensor.session.showNotice('SHAKE DETECTED');
  }, [detectedAt, sensor.session]);
  return {
    ...sensor, threshold,
    setThreshold(value: number) {
      const next = Math.round(clamp(value, 1.2, 4) * 10) / 10;
      test.setThreshold(next);
      setThreshold(next);
    },
    reset() { sensor.session.replaceData(test.reset()); sensor.session.clearNotice(); },
  };
}
