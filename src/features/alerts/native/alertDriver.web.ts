import type { AlertDriver } from '../types/alert.types';
import { toAlertData } from '../utils/alertRules';

// Web has no notifications, so test alerts go straight to the in-app path.
let received: ((data: unknown) => void) | undefined;

export const alertDriver: AlertDriver = {
  supported: false,
  setUp: async () => undefined,
  getPermission: async () => ({ permission: 'denied', canAskAgain: false }),
  requestPermission: async () => ({ permission: 'denied', canAskAgain: false }),
  getPushToken: async () => null,
  onReceived(listener) {
    received = listener;
    return { remove: () => { received = undefined; } };
  },
  onOpened: () => ({ remove: () => undefined }),
  present: async (alert) => received?.(toAlertData(alert)),
  playHaptic: async () => undefined,
};
