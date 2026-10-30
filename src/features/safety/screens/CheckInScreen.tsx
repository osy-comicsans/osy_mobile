import { useTranslation } from 'react-i18next';

import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

import { useDismissModal } from '../hooks/useDismissModal';

export function CheckInScreen() {
  const { t } = useTranslation();
  const dismiss = useDismissModal();

  return (
    <PlaceholderScreen
      title={t('safety.checkInTitle')}
      description={t('safety.checkInDescription')}>
      <Button label={t('common.dismiss')} variant="secondary" onPress={dismiss} />
    </PlaceholderScreen>
  );
}
