import { accelerometerDriver } from '../native/sensorDrivers';
import { useSensorSession } from './useSensorSession';

export const useAccelerometer = () => useSensorSession('accelerometer', accelerometerDriver);
