import { locationDriver } from '../native/sensorDrivers';
import { useSensorSession } from './useSensorSession';

export const useLocationTracking = () => useSensorSession('gps', locationDriver);
