import { useTranslation } from 'react-i18next';

import { Button } from '@/common/components/ui/button';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';

import { useDismissModal } from '../hooks/useDismissModal';

export function ReportAccidentScreen() {
  const { t } = useTranslation();
  const dismiss = useDismissModal();

  return (
    <PlaceholderScreen
      title={t('safety.reportTitle')}
      description={t('safety.reportDescription')}>
      <Button label={t('common.dismiss')} variant="secondary" onPress={dismiss} />
    </PlaceholderScreen>
  );
}
