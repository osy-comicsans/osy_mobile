import { createStore } from 'zustand/vanilla';

import type { Language } from '@/common/lib/i18n/languages';
import type { AppSettings } from '@/features/settings/types/settings.types';

import type {
  AlertChannel, AlertDriver, AlertPermission, AlertPreferences, AlertText, AppAlert, PushToken,
} from '../types/alert.types';
import { ALERT_RULES, CHECK_IN_ACTIONS, createAlertGate, parseAlert, toAlertData, usesHaptics, usesSound } from './alertRules';

export interface AlertState {
  banner: AppAlert | null;
  permission: AlertPermission;
  canAskAgain: boolean;
  requesting: boolean;
  // Settings (#20) writes here. Every alert is on until then.
  preferences: AlertPreferences;
}

interface AlertServiceOptions {
  driver: AlertDriver;
  navigate: (alert: AppAlert) => void;
  sendPushToken: (token: PushToken & { language: Language }) => Promise<void>;
  onCheckInAnswer?: (action: string) => void;
  now?: () => number;
  getSettings?: () => AppSettings;
  speak?: (alert: AppAlert) => void;
}

export function createAlertService({ driver, navigate, sendPushToken, onCheckInAnswer, getSettings, speak, now = Date.now }: AlertServiceOptions) {
  const store = createStore<AlertState>(() => ({
    banner: null,
    permission: 'undetermined',
    canAskAgain: true,
    requesting: false,
    preferences: { sound: true, haptics: true },
  }));
  const gate = createAlertGate();
  const alerts = new Map<string, AppAlert>();
  const raised = new Set<string>();
  const warningListeners = new Set<(alert: AppAlert) => void>();
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let sentLanguage: Language | null = null;
  const enabled = (alert: AppAlert) => {
    const settings = getSettings?.();
    return settings === undefined || (settings.notifications[alert.type] && (alert.type !== 'accident_nearby'
      || (alert.distanceMeters !== undefined && alert.distanceMeters <= settings.nearbyRadiusKm * 1000)));
  };

  const dismissBanner = () => {
    clearTimeout(bannerTimer);
    store.setState({ banner: null });
  };

  const showBanner = (alert: AppAlert) => {
    clearTimeout(bannerTimer);
    store.setState({ banner: alert });
    bannerTimer = setTimeout(dismissBanner, ALERT_RULES[alert.type].bannerDuration);
  };

  const receive = (data: unknown) => {
    const alert = parseAlert(data);
    if (!alert || (!enabled(alert) && alert.type !== 'crash_detected') || !gate.allows(alert, now())) return;
    gate.record(alert, now());
    alerts.set(alert.id, alert);

    const rule = ALERT_RULES[alert.type];
    if (enabled(alert) && (getSettings?.().voice ?? true)) speak?.(alert);
    if (enabled(alert) && usesHaptics(alert.type, store.getState().preferences)) {
      void driver.playHaptic(rule.severity).catch(() => undefined);
    }
    if (rule.fullScreen) navigate(alert);
    else showBanner(alert);
    // A crash alert starts a check-in instead of warning the driver.
    if (alert.type !== 'crash_detected') for (const listener of warningListeners) listener(alert);
  };

  // Tapping a notification always opens it, even if it was already shown.
  const open = (alert: AppAlert, action?: string) => {
    gate.record(alert, now());
    alerts.set(alert.id, alert);
    dismissBanner();
    if (action === CHECK_IN_ACTIONS.ok || action === CHECK_IN_ACTIONS.help) onCheckInAnswer?.(action);
    if (action !== CHECK_IN_ACTIONS.ok) navigate(alert);
  };

  const shouldPlaySound = (data: unknown) => {
    const alert = parseAlert(data);
    if (alert === null || !enabled(alert)) return false;
    return (gate.allows(alert, now()) || raised.delete(alert.id))
      && usesSound(alert.type, store.getState().preferences);
  };

  const applyPermission = async (read: () => ReturnType<AlertDriver['getPermission']>) => {
    const { permission, canAskAgain } = await read();
    store.setState({ permission, canAskAgain });
  };

  return {
    store,
    dismissBanner,
    refreshPermission: () => applyPermission(driver.getPermission).catch(() => undefined),
    open,
    getAlert: (id: string) => alerts.get(id) ?? null,

    // Told each warning the driver actually saw, after duplicates and disabled types are filtered out.
    onWarning(listener: (alert: AppAlert) => void) {
      warningListeners.add(listener);
      return () => { warningListeners.delete(listener); };
    },

    start(channels: AlertChannel[]) {
      const received = driver.onReceived(receive);
      const opened = driver.onOpened((data, action) => {
        const alert = parseAlert(data);
        if (alert) open(alert, action);
      });
      void driver.setUp(channels, shouldPlaySound).catch(() => undefined);
      void applyPermission(driver.getPermission).catch(() => undefined);

      return () => {
        dismissBanner();
        received.remove();
        opened.remove();
      };
    },

    async requestPermission() {
      store.setState({ requesting: true });
      try {
        await applyPermission(driver.requestPermission);
      } catch {
        // The prompt failed, so the card keeps offering it.
      } finally {
        store.setState({ requesting: false });
      }
    },

    // The server writes push text in this language, so a change must reach it.
    // Runs again on the next launch or sign-in if the server could not be reached.
    async registerPushToken(language: Language) {
      if (sentLanguage === language || store.getState().permission !== 'granted') return;
      const token = await driver.getPushToken();
      if (!token) return;
      await sendPushToken({ ...token, language });
      sentLanguage = language;
    },

    sendTest: (alert: AppAlert, text: AlertText, delaySeconds: number) => (
      driver.present(alert, text, delaySeconds)
    ),

    // Reacts at once, so a phone without notification permission still responds.
    // The notification adds the sound, and a lock-screen entry when backgrounded.
    raise(alert: AppAlert, text: AlertText) {
      if (enabled(alert)) raised.add(alert.id);
      receive(toAlertData(alert));
      if (enabled(alert)) void driver.present(alert, text, 0).catch(() => undefined);
    },
  };
}

export type AlertService = ReturnType<typeof createAlertService>;
