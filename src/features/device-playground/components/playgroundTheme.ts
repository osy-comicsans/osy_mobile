import { Platform } from 'react-native';

export const lab = {
  background: '#090D15', card: '#111925', inset: '#0C121D', border: '#263348',
  text: '#EDF3FF', muted: '#9BAAC0', accent: '#9CB8FF', green: '#68E0AC', red: '#FF8F9B',
  stopped: '#99A7BA', x: '#9CB8FF', y: '#72DFC3', z: '#F1BE7B',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
} as const;
