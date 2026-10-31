import { z } from 'zod';

import type { AlertPreferences, AlertSeverity, AlertType, AppAlert } from '../types/alert.types';

export const ALERT_TYPES = ['crash_detected', 'potential_accident', 'accident_nearby'] as const;

// Buttons on the crash notification, shown on the lock screen where the platform allows.
export const CHECK_IN_ACTIONS = { ok: 'im_ok', help: 'need_help' } as const;

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// A repeated delivery of one alert, such as a retried push, stays quiet for this long.
const DUPLICATE_WINDOW = 10 * MINUTE;

export const ALERT_RULES: Record<AlertType, {
  severity: AlertSeverity;
  fullScreen: boolean;
  minInterval: number;
  bannerDuration: number;
}> = {
  // Never rate limited: a second crash must not be swallowed by the first.
  crash_detected: { severity: 'critical', fullScreen: true, minInterval: 0, bannerDuration: 0 },
  potential_accident: { severity: 'warning', fullScreen: false, minInterval: 30 * SECOND, bannerDuration: 8 * SECOND },
  accident_nearby: { severity: 'info', fullScreen: false, minInterval: MINUTE, bannerDuration: 8 * SECOND },
};

// Pushes carry flat string values, so the distance arrives as text.
const alertDataSchema = z.object({
  alertId: z.string().min(1),
  alertType: z.enum(ALERT_TYPES),
  roadName: z.string().min(1).optional(),
  distanceMeters: z.coerce.number().nonnegative().optional(),
  detail: z.string().min(1).optional(),
});

// iOS delivers custom push values under `body`, and Android delivers them directly.
export function parseAlert(data: unknown): AppAlert | null {
  const source = (data as { body?: unknown } | null)?.body ?? data;
  const parsed = alertDataSchema.safeParse(typeof source === 'string' ? safeJson(source) : source);
  if (!parsed.success) return null;
  const { alertId, alertType, ...values } = parsed.data;
  return { id: alertId, type: alertType, ...values };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function toAlertData(alert: AppAlert): Record<string, string> {
  const { id, type, roadName, distanceMeters, detail } = alert;
  return {
    alertId: id,
    alertType: type,
    ...(roadName ? { roadName } : {}),
    ...(distanceMeters === undefined ? {} : { distanceMeters: String(distanceMeters) }),
    ...(detail ? { detail } : {}),
  };
}

// Crash alerts ignore these settings, because a silent one could delay the emergency response.
export function usesSound(type: AlertType, preferences: AlertPreferences) {
  return ALERT_RULES[type].severity === 'critical' || preferences.sound;
}

export function usesHaptics(type: AlertType, preferences: AlertPreferences) {
  return ALERT_RULES[type].severity === 'critical' || preferences.haptics;
}

export function createAlertGate() {
  const seen = new Map<string, number>();
  const lastShown = new Map<AlertType, number>();

  const allows = (alert: AppAlert, now: number) => {
    const shownAt = seen.get(alert.id);
    if (shownAt !== undefined && now - shownAt < DUPLICATE_WINDOW) return false;
    const last = lastShown.get(alert.type);
    return last === undefined || now - last >= ALERT_RULES[alert.type].minInterval;
  };

  const record = (alert: AppAlert, now: number) => {
    for (const [id, time] of seen) if (now - time >= DUPLICATE_WINDOW) seen.delete(id);
    seen.set(alert.id, now);
    lastShown.set(alert.type, now);
  };

  return { allows, record };
}
