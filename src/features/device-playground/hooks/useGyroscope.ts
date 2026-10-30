import { gyroscopeDriver } from '../native/sensorDrivers';
import { useSensorSession } from './useSensorSession';

export const useGyroscope = () => useSensorSession('gyroscope', gyroscopeDriver);
