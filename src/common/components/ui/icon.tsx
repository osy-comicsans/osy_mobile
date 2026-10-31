import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { I18nManager, Platform } from 'react-native';

import { Colors } from '@/common/lib/theme';

const icons = {
  back: { ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' },
  forward: { ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' },
  person: { ios: 'person', android: 'person', web: 'person' },
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
  phone: { ios: 'phone', android: 'call', web: 'call' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  show: { ios: 'eye', android: 'visibility', web: 'visibility' },
  hide: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  file: { ios: 'doc', android: 'description', web: 'description' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  error: { ios: 'exclamationmark.circle', android: 'error', web: 'error' },
  location: { ios: 'location.fill', android: 'my_location', web: 'my_location' },
  shield: { ios: 'lock.shield', android: 'shield_lock', web: 'shield_lock' },
  mic: { ios: 'mic', android: 'mic', web: 'mic' },
  micOff: { ios: 'mic.slash', android: 'mic_off', web: 'mic_off' },
  speaker: { ios: 'speaker.wave.2', android: 'volume_up', web: 'volume_up' },
  car: { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
  people: { ios: 'person.2', android: 'group', web: 'group' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
} satisfies Record<string, SymbolViewProps['name']>;

// These point the way the reader moves. SF Symbols flip them on their own in
// right-to-left layouts, and Material Symbols need it done here.
const directional = new Set<IconName>(['back', 'forward']);

export type IconName = keyof typeof icons;

export function Icon({ name, size = 20, color = Colors.textTertiary }: { name: IconName; size?: number; color?: string }) {
  const mirrored = Platform.OS === 'android' && I18nManager.isRTL && directional.has(name);
  return (
    <SymbolView
      name={icons[name]}
      size={size}
      tintColor={color}
      style={mirrored ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );
}
