import type { Removable } from '@/features/location/types/location.types';

export type AlertType = 'crash_detected' | 'potential_accident' | 'accident_nearby';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertPermission = 'undetermined' | 'granted' | 'denied';

export interface AppAlert {
  id: string;
  type: AlertType;
  roadName?: string;
  distanceMeters?: number;
}

export interface AlertPreferences {
  sound: boolean;
  haptics: boolean;
}

export interface AlertPermissionSummary {
  permission: AlertPermission;
  canAskAgain: boolean;
}

export interface AlertText {
  title: string;
  body: string;
}

export interface AlertChannel extends AlertText {
  type: AlertType;
  severity: AlertSeverity;
  actions: { id: string; label: string }[];
}

export interface PushToken {
  token: string;
  platform: 'ios' | 'android';
}

export interface AlertDriver {
  supported: boolean;
  setUp(
    channels: AlertChannel[],
    shouldPlaySound: (data: unknown) => boolean,
  ): Promise<void>;
  getPermission(): Promise<AlertPermissionSummary>;
  requestPermission(): Promise<AlertPermissionSummary>;
  getPushToken(): Promise<PushToken | null>;
  onReceived(listener: (data: unknown) => void): Removable;
  onOpened(listener: (data: unknown, action: string) => void): Removable;
  present(alert: AppAlert, text: AlertText, delaySeconds: number): Promise<void>;
  playHaptic(severity: AlertSeverity): Promise<void>;
}
