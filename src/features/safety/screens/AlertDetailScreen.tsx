import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/common/components/themed-text';
import { Button } from '@/common/components/ui/button';
import { distanceParts } from '@/common/lib/i18n/format';
import { getLanguage } from '@/common/lib/i18n/i18n';
import { PlaceholderScreen } from '@/common/screens/PlaceholderScreen';
import { useAlertService } from '@/features/alerts/hooks/useAlerts';
import { useCurrentLocation } from '@/features/location/hooks/useLocation';
import { useSettings } from '@/features/settings/hooks/useSettings';

import { useDismissModal } from '../hooks/useDismissModal';
import { useNearbyIncident } from '../hooks/useNearbyIncidents';
import { nearbyIncidents } from '../nearbyServices';

export function AlertDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dismiss = useDismissModal();
  const alert = useAlertService().getAlert(id);
  const nearby = alert?.type === 'accident_nearby';
  const incident = useNearbyIncident(nearby ? id : undefined);
  const fix = useCurrentLocation();
  const { settings } = useSettings();
  const askedNearby = useRef(false);
  const distanceMeters = incident?.distanceMeters ?? alert?.distanceMeters;
  const distance = distanceMeters === undefined ? null : distanceParts(getLanguage(), distanceMeters, settings.units);
  const roadName = incident?.roadName ?? alert?.roadName;

  // A push can be opened before the app has looked nearby, and the route needs
  // the incident's location, so it looks once.
  useEffect(() => {
    if (!nearby || incident || !fix || askedNearby.current) return;
    askedNearby.current = true;
    void nearbyIncidents.refresh(fix);
  }, [nearby, incident, fix]);

  return (
    <PlaceholderScreen
      title={alert ? t(`alerts.${alert.type}.title`) : t('safety.alertTitle')}
      description={alert ? alert.detail ?? t(`alerts.${alert.type}.body`) : t('safety.alertDescription')}>
      {incident && <ThemedText type="bodyMedium">{t(`nearby.severity.${incident.severity}`)}</ThemedText>}
      {roadName && <ThemedText type="bodyMedium">{roadName}</ThemedText>}
      {distance && (
        <ThemedText type="body" themeColor="textSecondary">
          {t('alerts.distanceAway', { distance: t(`units.${distance.unit}`, { value: distance.value }) })}
        </ThemedText>
      )}
      {nearby && (
        <Button
          label={t('nearby.navigate')}
          disabled={!incident}
          onPress={() => router.dismissTo({ pathname: '/map', params: { incident: id } })}
        />
      )}
      <Button label={t('common.dismiss')} variant="secondary" onPress={dismiss} />
    </PlaceholderScreen>
  );
}
