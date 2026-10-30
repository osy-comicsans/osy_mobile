import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { AlertDevMenu } from '@/features/alerts/components/AlertDevMenu';

import { LanguageSetting } from '../components/LanguageSetting';

export function SettingsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('settings.title')}
      description={t('settings.description')}>
      <LanguageSetting />
      {__DEV__ && <AlertDevMenu />}
    </PlaceholderScreen>
  );
}
