import { useColorScheme } from 'react-native';
import { Colors, DarkColors } from '@/common/lib/tokens';
import { useSettings } from '@/features/settings/hooks/useSettings';

export function useTheme() {
  const system = useColorScheme();
  const { settings } = useSettings();
  return (settings.theme === 'dark' || (settings.theme === 'system' && system === 'dark')) ? DarkColors : Colors;
}
