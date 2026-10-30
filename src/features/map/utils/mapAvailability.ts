import { TurboModuleRegistry } from 'react-native';

// Expo Go has no MapLibre, and the package throws while loading without it.
export function isMapAvailable(): boolean {
  return TurboModuleRegistry.get('MLRNMapViewModule') !== null;
}
