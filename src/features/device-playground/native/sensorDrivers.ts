import * as Location from 'expo-location';
import { Accelerometer, Gyroscope, DeviceMotion, Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';

import type { AccelerationReading, GyroscopeReading, LocationReading, MotionReading, SensorDriver, ShakeReading, StepReading } from '../types/sensor.types';
import { SENSOR_INTERVAL_MS, ShakeDetector, StepCounter } from '../utils/sensor.utils';

const native = Platform.OS === 'android' || Platform.OS === 'ios';
const hardwareMessage = 'This test requires a supported physical Android or iOS device. Browser sensor values are not used as substitutes.';
const options: Location.LocationOptions = { accuracy: Location.Accuracy.High, timeInterval: 1_000, distanceInterval: 0, mayShowUserSettingsDialog: false };

export const locationDriver: SensorDriver<LocationReading> = {
  available: () => Location.hasServicesEnabledAsync(),
  getPermission: () => Location.getForegroundPermissionsAsync(),
  requestPermission: () => Location.requestForegroundPermissionsAsync(),
  subscribe: (onData, onError) => Location.watchPositionAsync(options, onData, onError),
  read: () => Location.getCurrentPositionAsync(options),
  unavailableMessage: 'Location services are unavailable or switched off. Enable device location services and try again.',
  firstSampleTimeoutMs: 30_000,
  timeoutMessage: 'No location fix arrived. Check location permission and location services, then try outdoors.',
};

export const accelerometerDriver: SensorDriver<AccelerationReading> = {
  available: async () => native && await Accelerometer.isAvailableAsync(),
  getPermission: () => Accelerometer.getPermissionsAsync(),
  requestPermission: () => Accelerometer.requestPermissionsAsync(),
  subscribe: (onData) => {
    // Shake uses the same interval. Each section removes only its own listener.
    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    return Accelerometer.addListener(onData);
  },
  unavailableMessage: hardwareMessage,
  firstSampleTimeoutMs: 8_000,
};

export const gyroscopeDriver: SensorDriver<GyroscopeReading> = {
  available: async () => native && await Gyroscope.isAvailableAsync(),
  getPermission: () => Gyroscope.getPermissionsAsync(),
  requestPermission: () => Gyroscope.requestPermissionsAsync(),
  subscribe: (onData) => {
    Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS);
    return Gyroscope.addListener(onData);
  },
  unavailableMessage: hardwareMessage,
  firstSampleTimeoutMs: 8_000,
};

export const motionDriver: SensorDriver<MotionReading> = {
  available: async () => native && await DeviceMotion.isAvailableAsync(),
  getPermission: () => DeviceMotion.getPermissionsAsync(),
  requestPermission: () => DeviceMotion.requestPermissionsAsync(),
  subscribe: (onData) => {
    DeviceMotion.setUpdateInterval(SENSOR_INTERVAL_MS);
    return DeviceMotion.addListener(onData);
  },
  unavailableMessage: hardwareMessage,
  firstSampleTimeoutMs: 8_000,
};

export function createShakeDriver() {
  const detector = new ShakeDetector();
  let latest: ShakeReading = { magnitude: null, count: 0, detectedAt: null };
  const driver: SensorDriver<ShakeReading> = {
    ...accelerometerDriver,
    read: undefined,
    subscribe: (onData) => {
      detector.begin();
      Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
      let active = true;
      const subscription = Accelerometer.addListener((data) => {
        if (!active) return;
        latest = detector.sample(data, Date.now());
        onData(latest);
      });
      return { remove() { active = false; subscription.remove(); } };
    },
  };
  return {
    driver,
    setThreshold(value: number) { detector.threshold = value; },
    reset() { detector.reset(); latest = { ...latest, count: 0, detectedAt: null }; return latest; },
  };
}

export function createPedometerDriver() {
  let counter = new StepCounter();
  const driver: SensorDriver<StepReading> = {
    available: async () => native && await Pedometer.isAvailableAsync(),
    getPermission: () => Pedometer.getPermissionsAsync(),
    requestPermission: () => Pedometer.requestPermissionsAsync(),
    subscribe: (onData) => {
      counter = new StepCounter();
      let active = true;
      const subscription = Pedometer.watchStepCount(({ steps }) => {
        if (active) onData(counter.sample(steps));
      });
      return { remove() { active = false; subscription.remove(); } };
    },
    unavailableMessage: 'No supported pedometer was found. Step counting requires a compatible physical Android or iOS device.',
    // A step event can legitimately take minutes to arrive while stationary.
  };
  return { driver, reset: () => counter.reset() };
}
