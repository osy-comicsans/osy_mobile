import { createContext, useEffect, useState, type PropsWithChildren } from 'react';

import { subscribeToForeground } from '@/common/lib/native/appLifecycle';

import { createCheckInService, type CheckInService } from '../utils/checkInService';
import { escalateCheckIn } from '../utils/escalateCheckIn';

export const CheckInContext = createContext<CheckInService | null>(null);

// Reminders are sent through this holder because alerts sit inside this provider.
export const checkInReminder = { send: () => {} };

export function CheckInProvider({ children }: PropsWithChildren) {
  const [service] = useState(() => createCheckInService({
    escalate: escalateCheckIn,
    remind: () => checkInReminder.send(),
  }));

  useEffect(() => subscribeToForeground((active) => {
    if (active) service.sync();
  }), [service]);

  return <CheckInContext value={service}>{children}</CheckInContext>;
}
