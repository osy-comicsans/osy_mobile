import { useContext } from 'react';
import { useStore } from 'zustand';

import { EscalationContext } from '../providers/CheckInProvider';

export function useEscalation() {
  const service = useContext(EscalationContext);
  if (!service) throw new Error('Escalation hooks require CheckInProvider.');
  return { service, state: useStore(service.store) };
}
