import { useStore } from 'zustand';
import { useLiveClock } from '@/common/hooks/use-live-clock';
import { useDrivingMode } from '@/features/driving/hooks/useDrivingMode';
import { useLocationState } from '@/features/location/hooks/useLocation';
import { useCrashDetectionService } from '@/features/crash-detection/hooks/useCrashDetection';
import { homeMonitoringStatus } from '../utils/homePresentation';

export function useMonitoringStatus() {
  const mode = useDrivingMode();
  const location = useLocationState();
  const sensor = useStore(useCrashDetectionService().store, (state) => state.status);
  return homeMonitoringStatus(mode, location, sensor, useLiveClock());
}
