import { useLiveClock } from '@/common/hooks/use-live-clock';
import { useLocationState } from '@/features/location/hooks/useLocation';
import { homeLocationPresentation } from '../utils/homePresentation';

export function useHomeLocation() {
  return homeLocationPresentation(useLocationState(), useLiveClock());
}
