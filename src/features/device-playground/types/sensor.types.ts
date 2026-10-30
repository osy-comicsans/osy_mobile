import type { LocationObject } from 'expo-location';
import type { AccelerometerMeasurement, GyroscopeMeasurement, DeviceMotionMeasurement } from 'expo-sensors';

export type SensorId = 'gps' | 'accelerometer' | 'gyroscope' | 'motion' | 'shake' | 'pedometer';
export type SensorPhase = 'stopped' | 'starting' | 'running' | 'denied' | 'unavailable' | 'error';
export interface SensorPermission {
  status: 'undetermined' | 'granted' | 'denied';
  granted: boolean;
  canAskAgain: boolean;
}
export interface SensorSnapshot<T> {
  phase: SensorPhase;
  permission: SensorPermission | null;
  available: boolean | null;
  data: T | null;
  updatedAt: number | null;
  refreshing: boolean;
  error: string | null;
  notice: string | null;
}
export interface Removable { remove(): void }
export interface SensorDriver<T> {
  available(): Promise<boolean>;
  getPermission(): Promise<SensorPermission>;
  requestPermission(): Promise<SensorPermission>;
  subscribe(onData: (data: T) => void, onError: (error: unknown) => void): Promise<Removable> | Removable;
  read?(): Promise<T>;
  unavailableMessage: string;
  firstSampleTimeoutMs?: number;
  timeoutMessage?: string;
}
export interface Vector3 { x: number; y: number; z: number }
export type LocationReading = LocationObject;
export type AccelerationReading = AccelerometerMeasurement;
export type GyroscopeReading = GyroscopeMeasurement;
export type MotionReading = Partial<DeviceMotionMeasurement>;
export interface ShakeReading { magnitude: number | null; count: number; detectedAt: number | null }
export interface StepReading { steps: number; rawSteps: number | null }
