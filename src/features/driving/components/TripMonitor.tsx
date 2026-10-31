import { useEffect, useState } from 'react';

import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { authSession } from '@/common/lib/api/axios';
import { createId } from '@/common/lib/native/uuid';
import { useAlertService } from '@/features/alerts/hooks/useAlerts';
import { useLocationService } from '@/features/location/hooks/useLocation';

import { useDrivingModeService } from '../hooks/useDrivingMode';
import { bindMonitoring } from '../utils/bindMonitoring';
import { createTripRecorder } from '../utils/tripRecorder';

// Renders nothing. Records trips while monitoring is on, for the driving stats on Profile.
export function TripMonitor() {
  const mode = useDrivingModeService();
  const location = useLocationService();
  const alerts = useAlertService();
  const runtime = useOfflineRuntime();
  const { supported } = useOfflineStatus();
  const [recorder] = useState(() => createTripRecorder({
    location: location.store,
    trips: runtime.trips,
    createId,
    // Nothing is recorded while data is being erased, so the erase also ends the trip under way.
    owner: () => {
      const { status, userId } = authSession.status.getState();
      return status === 'signedIn' && !runtime.status.getState().privacyBlocked ? userId : null;
    },
    onFinished: () => { void runtime.changed(); void runtime.sync.requestSync(); },
  }));

  useEffect(() => {
    // The web preview has no local database to keep trips in.
    if (!supported) return;
    void recorder.recover().catch(() => undefined);
    const unbind = bindMonitoring(mode.store, recorder);
    const unsubscribe = alerts.onWarning(() => recorder.countWarning());
    return () => { unsubscribe(); unbind(); };
  }, [alerts, mode, recorder, supported]);

  return null;
}
