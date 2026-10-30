import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

export function ProfileScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('profile.title')}
      description={t('profile.description')}>
      <Button label={t('profile.settings')} variant="secondary" onPress={() => router.push('/profile/settings')} />
    </PlaceholderScreen>
  );
}
