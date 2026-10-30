import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { distanceParts } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { useAlertService } from '@/features/alerts/hooks/useAlerts';

import { useDismissModal } from '../hooks/useDismissModal';

export function AlertDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dismiss = useDismissModal();
  const alert = useAlertService().getAlert(id);
  const distance = alert?.distanceMeters === undefined ? null : distanceParts(getLanguage(), alert.distanceMeters);

  return (
    <PlaceholderScreen
      title={alert ? t(`alerts.${alert.type}.title`) : t('safety.alertTitle')}
      description={alert ? t(`alerts.${alert.type}.body`) : t('safety.alertDescription')}>
      {alert?.roadName && <ThemedText type="bodyMedium">{alert.roadName}</ThemedText>}
      {distance && (
        <ThemedText type="body" themeColor="textSecondary">
          {t('alerts.distanceAway', { distance: t(`units.${distance.unit}`, { value: distance.value }) })}
        </ThemedText>
      )}
      <Button label={t('common.dismiss')} variant="secondary" onPress={dismiss} />
    </PlaceholderScreen>
  );
}
