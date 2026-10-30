import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { Colors } from '@/common/lib/theme';

import type { AlertDriver, AlertPermissionSummary, AlertSeverity } from '../types/alert.types';
import { toAlertData } from '../utils/alertRules';

const importance = {
  critical: AndroidImportance.MAX,
  warning: AndroidImportance.HIGH,
  info: AndroidImportance.DEFAULT,
} as const;

const vibration: Record<AlertSeverity, number[]> = {
  critical: [0, 500, 200, 500, 200, 500],
  warning: [0, 300, 200, 300],
  info: [0, 200],
};

function toSummary(result: Notifications.NotificationPermissionsStatus): AlertPermissionSummary {
  return {
    permission: result.granted ? 'granted' : result.status === 'undetermined' ? 'undetermined' : 'denied',
    canAskAgain: result.canAskAgain,
  };
}

export const alertDriver: AlertDriver = {
  supported: true,

  async setUp(channels, shouldPlaySound) {
    // In the foreground the app shows its own banner or screen instead.
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: shouldPlaySound(notification.request.content.data),
        shouldSetBadge: false,
      }),
    });

    await Promise.all(channels.flatMap(({ type, severity, title, body, actions }) => [
      Notifications.setNotificationCategoryAsync(type, actions.map(({ id, label }) => ({
        identifier: id,
        buttonTitle: label,
        options: { opensAppToForeground: true },
      }))),
      ...(Platform.OS === 'android' ? [Notifications.setNotificationChannelAsync(type, {
        name: title,
        description: body,
        importance: importance[severity],
        vibrationPattern: vibration[severity],
        lightColor: Colors.accent,
        sound: 'default',
      })] : []),
    ]));
  },

  getPermission: async () => toSummary(await Notifications.getPermissionsAsync()),
  requestPermission: async () => toSummary(await Notifications.requestPermissionsAsync()),

  // Skipped until the app is linked to an EAS project, which issues the Expo token.
  async getPushToken() {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data, platform: Platform.OS };
  },

  onReceived: (listener) => Notifications.addNotificationReceivedListener((notification) => {
    listener(notification.request.content.data);
  }),

  onOpened(listener) {
    const handle = (response: Notifications.NotificationResponse) => {
      // Otherwise the language reload would open this notification a second time.
      Notifications.clearLastNotificationResponse();
      listener(response.notification.request.content.data, response.actionIdentifier);
    };
    const coldStart = Notifications.getLastNotificationResponse();
    if (coldStart) handle(coldStart);
    return Notifications.addNotificationResponseReceivedListener(handle);
  },

  async present(alert, { title, body }, delaySeconds) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: toAlertData(alert), categoryIdentifier: alert.type, sound: 'default' },
      trigger: delaySeconds > 0
        ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
          channelId: alert.type,
        }
        : { channelId: alert.type },
    });
  },

  playHaptic(severity) {
    if (severity === 'critical') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (severity === 'warning') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
};
