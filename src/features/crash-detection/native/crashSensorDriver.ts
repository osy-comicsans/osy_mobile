import { Accelerometer, Gyroscope, type AccelerometerMeasurement } from 'expo-sensors';
import { Platform } from 'react-native';

import type { CrashSensorDriver, MotionSample } from '../types/crash.types';

// 50 Hz samples an impact pulse of about 100 ms several times. Android 12+
// delivers it only with HIGH_SAMPLING_RATE_SENSORS (app.json); otherwise ~5 Hz.
const SAMPLE_INTERVAL_MS = 20;
const native = Platform.OS === 'android' || Platform.OS === 'ios';

// Sensor timestamps count seconds since boot. The first sample anchors them to
// the wall clock, which GPS fixes also use.
function wallClock() {
  let offset: number | null = null;
  return ({ x, y, z, timestamp }: AccelerometerMeasurement): MotionSample => {
    const t = timestamp * 1_000;
    offset ??= Date.now() - t;
    return { t: t + offset, x, y, z };
  };
}

export const crashSensorDriver: CrashSensorDriver = {
  available: async () => native && (await Accelerometer.isAvailableAsync()),
  subscribe: async (onAcceleration, onRotation) => {
    // Some Android phones have no gyroscope; detection then uses acceleration alone.
    const hasGyroscope = await Gyroscope.isAvailableAsync();
    const accelerationTime = wallClock();
    const rotationTime = wallClock();
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    const subscriptions = [Accelerometer.addListener((data) => onAcceleration(accelerationTime(data)))];
    if (hasGyroscope) {
      Gyroscope.setUpdateInterval(SAMPLE_INTERVAL_MS);
      subscriptions.push(Gyroscope.addListener((data) => onRotation(rotationTime(data))));
    }
    return { remove: () => subscriptions.forEach((subscription) => subscription.remove()) };
  },
};
