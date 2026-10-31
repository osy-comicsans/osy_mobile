import { Linking, Platform } from 'react-native';
export const canOpenSystemSettings = Platform.OS !== 'web';
export const openSystemSettings = () => Linking.openSettings();
