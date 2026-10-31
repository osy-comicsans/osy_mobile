import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/common/components/ui/button';
import { Icon } from '@/common/components/ui/icon';
import { Colors } from '@/common/lib/theme';

export function ReportAccidentButton() {
  const { t } = useTranslation();
  return (
    <Button
      label={t('report.button')}
      leftIcon={<Icon name="warning" size={18} color={Colors.onAccent} />}
      onPress={() => router.push('/report-accident')}
    />
  );
}
