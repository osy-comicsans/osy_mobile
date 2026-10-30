import { motionDriver } from '../native/sensorDrivers';
import { useSensorSession } from './useSensorSession';

export const useDeviceMotion = () => useSensorSession('motion', motionDriver);
