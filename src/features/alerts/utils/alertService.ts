import { createStore } from 'zustand/vanilla';

import type { Language } from '@/common/lib/i18n/languages';

import type {
  AlertChannel, AlertDriver, AlertPermission, AlertPreferences, AlertText, AppAlert, PushToken,
} from '../types/alert.types';
import { ALERT_RULES, createAlertGate, parseAlert, usesHaptics, usesSound } from './alertRules';

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
  now?: () => number;
}

export function createAlertService({ driver, navigate, sendPushToken, now = Date.now }: AlertServiceOptions) {
  const store = createStore<AlertState>(() => ({
    banner: null,
    permission: 'undetermined',
    canAskAgain: true,
    requesting: false,
    preferences: { sound: true, haptics: true },
  }));
  const gate = createAlertGate();
  const alerts = new Map<string, AppAlert>();
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let sentLanguage: Language | null = null;

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
    if (!alert || !gate.allows(alert, now())) return;
    gate.record(alert, now());
    alerts.set(alert.id, alert);

    const rule = ALERT_RULES[alert.type];
    if (usesHaptics(alert.type, store.getState().preferences)) {
      void driver.playHaptic(rule.severity).catch(() => undefined);
    }
    if (rule.fullScreen) navigate(alert);
    else showBanner(alert);
  };

  // Tapping a notification always opens it, even if it was already shown.
  const open = (alert: AppAlert) => {
    gate.record(alert, now());
    alerts.set(alert.id, alert);
    dismissBanner();
    navigate(alert);
  };

  const shouldPlaySound = (data: unknown) => {
    const alert = parseAlert(data);
    return alert !== null
      && gate.allows(alert, now())
      && usesSound(alert.type, store.getState().preferences);
  };

  const applyPermission = async (read: () => ReturnType<AlertDriver['getPermission']>) => {
    const { permission, canAskAgain } = await read();
    store.setState({ permission, canAskAgain });
  };

  return {
    store,
    dismissBanner,
    open,
    getAlert: (id: string) => alerts.get(id) ?? null,

    start(channels: AlertChannel[], viewLabel: string) {
      const received = driver.onReceived(receive);
      const opened = driver.onOpened((data) => {
        const alert = parseAlert(data);
        if (alert) open(alert);
      });
      void driver.setUp(channels, viewLabel, shouldPlaySound).catch(() => undefined);
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
  };
}

export type AlertService = ReturnType<typeof createAlertService>;
