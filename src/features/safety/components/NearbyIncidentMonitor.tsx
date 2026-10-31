import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useAlertService } from '@/features/alerts/hooks/useAlerts';
import { useCurrentLocation } from '@/features/location/hooks/useLocation';

import { useCheckInState } from '../hooks/useCheckIn';
import { nearbyIncidents } from '../nearbyServices';

// Renders nothing. While the app is open it looks for accidents nearby, so the
// user can go and help.
export function NearbyIncidentMonitor() {
  const { t } = useTranslation();
  const alerts = useAlertService();
  const fix = useCurrentLocation();
  const { status: checkIn } = useCheckInState();

  useEffect(() => {
    if (!fix) return;
    const busy = checkIn === 'waiting' || checkIn === 'escalated';
    void nearbyIncidents.update(fix, busy).then((incident) => {
      if (!incident) return;
      alerts.raise(
        {
          id: incident.id,
          type: 'accident_nearby',
          roadName: incident.roadName ?? undefined,
          distanceMeters: Math.round(incident.distanceMeters),
        },
        { title: t('alerts.accident_nearby.title'), body: t('alerts.accident_nearby.body') },
      );
    });
    // Runs once for each fix, and everything else is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix]);

  return null;
}
