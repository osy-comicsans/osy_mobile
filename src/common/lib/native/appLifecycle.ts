import { AppState, Platform } from 'react-native';

export const supportsLocalDatabase = Platform.OS === 'ios' || Platform.OS === 'android';

export function subscribeToForeground(listener: (active: boolean) => void): () => void {
  listener(AppState.currentState === 'active' || AppState.currentState === null);
  const subscription = AppState.addEventListener('change', (state) => listener(state === 'active'));
  return () => subscription.remove();
}
