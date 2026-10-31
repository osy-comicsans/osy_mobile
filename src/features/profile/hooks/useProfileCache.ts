import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import type { ProfileService } from '../utils/profileService';

const key = (userId: string | null) => ['local', 'profile', userId] as const;

export function useProfileCacheInvalidation(service: ProfileService) {
  const client = useQueryClient();
  useEffect(() => service.store.subscribe((state, previous) => {
    if (previous.userId && previous.userId !== state.userId) {
      void client.cancelQueries({ queryKey: key(previous.userId) });
      client.removeQueries({ queryKey: key(previous.userId) });
    }
    if (state.userId && state.revision !== previous.revision) void client.invalidateQueries({ queryKey: key(state.userId) });
  }), [client, service]);
}

export function useProfileCache(service: ProfileService, userId: string | null, enabled: boolean) {
  return useQuery({ queryKey: key(userId), queryFn: () => service.read(userId), enabled,
    networkMode: 'always', retry: false, staleTime: Infinity });
}

// Queued reports have no owner: whoever is signed in when the queue runs sends them.
export function useWaitingReports() {
  const runtime = useOfflineRuntime(); const { ready } = useOfflineStatus();
  return useQuery({ queryKey: ['local', 'reports', 'waiting'], queryFn: () => runtime.reports.waiting(), enabled: ready,
    networkMode: 'always', retry: false, staleTime: Infinity });
}

// Finished trips the server has not counted yet, so the totals include them once.
export function useWaitingTrips(userId: string | null) {
  const runtime = useOfflineRuntime(); const { ready } = useOfflineStatus();
  return useQuery({ queryKey: ['local', 'trips', userId], queryFn: () => (userId ? runtime.trips.waiting(userId) : null), enabled: ready && userId !== null,
    networkMode: 'always', retry: false, staleTime: Infinity });
}
