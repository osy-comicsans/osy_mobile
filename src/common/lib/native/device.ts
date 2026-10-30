import * as Device from 'expo-device';
import { Platform } from 'react-native';

export function getDeveloperMenuHint(): string {
  if (Platform.OS === 'web') {
    return 'use browser devtools';
  }

  if (Device.isDevice) {
    return 'shake device or press m in terminal';
  }

  return Platform.OS === 'android' ? 'press cmd+m (or ctrl+m)' : 'press cmd+d';
}
