import { useTranslation } from 'react-i18next';

import { AccountPage } from '@/common/components/ui/account-page';

import { ProfileEditor } from '../components/ProfileEditor';
import { useProfile } from '../providers/ProfileDataProvider';

export function EditProfileScreen() {
  const { t } = useTranslation();
  const { cache, rejection } = useProfile();
  return (
    <AccountPage title={t('account.details')}>
      {cache ? <ProfileEditor key={cache.bundle.profile.id} bundle={cache.bundle} rejection={rejection} /> : null}
    </AccountPage>
  );
}
