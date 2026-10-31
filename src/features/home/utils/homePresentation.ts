import type { LocationState } from '@/features/location/types/location.types';
import type { DrivingModeState } from '@/features/driving/utils/drivingModeService';
import type { CrashDetectionStatus } from '@/features/crash-detection/types/crash.types';

export function homeLocationPresentation(state: LocationState, now: number) {
  const fix = state.fix;
  const allowed = state.location === 'granted' || state.location === 'limited';
  const fresh = Boolean(allowed && state.status === 'watching' && fix
    && now - fix.timestamp <= 30_000 && fix.timestamp <= now + 300_000);
  const loading = allowed && !fix && (state.status === 'checking' || state.status === 'watching');
  return {
    fix, fresh, loading,
    status: !allowed ? 'permission' : fresh ? 'live' : fix ? 'stale' : loading ? 'loading' : 'unavailable',
    speedKmh: fresh ? (fix?.speedKmh ?? null) : null,
    heading: fresh ? (fix?.heading ?? null) : null,
    movement: fresh ? state.drivingState : null,
    approximate: state.location === 'limited',
  } as const;
}

export function homeMonitoringStatus(
  mode: DrivingModeState, location: LocationState, sensor: CrashDetectionStatus, now: number,
) {
  if (!mode.ready) return 'restoring';
  if (mode.paused) return 'paused';
  const { fresh } = homeLocationPresentation(location, now);
  if (location.location === 'denied' || location.location === 'limited' || location.motion === 'denied'
    || location.status === 'error' || location.status === 'servicesDisabled' || sensor === 'unavailable') return 'limited';
  if (!fresh) return 'waiting';
  if (location.drivingState !== 'driving') return 'automatic';
  return sensor === 'monitoring' ? 'monitoring' : 'waiting';
}
