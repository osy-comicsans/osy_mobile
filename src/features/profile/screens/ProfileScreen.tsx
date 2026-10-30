import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { authApi } from '@/features/auth/authServices';

export function ProfileScreen() {
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);

  // Ending the session moves the account to signed out, and the route guards go to Login.
  const logOut = () => {
    setSigningOut(true);
    void authApi.signOut();
  };

  return (
    <PlaceholderScreen
      title={t('profile.title')}
      description={t('profile.description')}>
      <Button label={t('profile.settings')} variant="secondary" onPress={() => router.push('/profile/settings')} />
      <Button label={t('profile.logout')} variant="logout" loading={signingOut} onPress={logOut} />
    </PlaceholderScreen>
  );
}
