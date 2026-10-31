import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { api } from '@/common/lib/api/axios';
import { subscribeToForeground } from '@/common/lib/native/appLifecycle';
import { secureStorage } from '@/common/lib/storage/secureStorage';
import { useLocationService } from '@/features/location/hooks/useLocation';
import { RoadContext } from '@/features/roads/providers/RoadProvider';

import { createSafetyApi } from '../api/safetyApi';
import { nearbyIncidents } from '../nearbyServices';
import { createCheckInService, type CheckInService } from '../utils/checkInService';
import { createEscalationService, type EscalationService } from '../utils/escalationService';

export const CheckInContext = createContext<CheckInService | null>(null);
export const EscalationContext = createContext<EscalationService | null>(null);

// Reminders are sent through this holder because alerts sit inside this provider.
export const checkInReminder = { send: () => {} };

const safetyApi = createSafetyApi(api);

export function CheckInProvider({ children }: PropsWithChildren) {
  const location = useLocationService();
  const road = useContext(RoadContext);
  const [escalation] = useState(() => createEscalationService({
    api: safetyApi,
    location: location.store,
    currentRoad: () => road?.store.getState().road ?? null,
    storage: secureStorage,
    createId: randomUUID,
    onIncident: (id) => void nearbyIncidents.markOwn(id),
  }));
  const [service] = useState(() => createCheckInService({
    escalate: (trigger, event) => void escalation.start(trigger, event),
    remind: () => checkInReminder.send(),
    cancelEscalation: () => void escalation.cancel(),
  }));

  useEffect(() => {
    void escalation.restore();
    return escalation.stop;
  }, [escalation]);

  useEffect(() => subscribeToForeground((active) => {
    if (active) service.sync();
  }), [service]);

  return (
    <EscalationContext value={escalation}>
      <CheckInContext value={service}>{children}</CheckInContext>
    </EscalationContext>
  );
}
