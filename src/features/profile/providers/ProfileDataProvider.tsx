import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useStore } from 'zustand';
import { authSession } from '@/common/lib/api/axios';
import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { profileApi } from '@/features/auth/authServices';
import { settingsService } from '@/features/settings/settingsService';
import { createProfileService, profileForAccount, type ProfileService } from '../utils/profileService';
import type { ProfileBundle } from '../types/profile.schemas';
import type { ProfileCache } from '@/common/lib/database/repositories/profileRepository';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { useProfileCache, useProfileCacheInvalidation } from '../hooks/useProfileCache';
import { createPreferencesSync } from '@/common/lib/database/sync/preferencesSync';

const ProfileContext = createContext<ProfileService | null>(null);
export function ProfileDataProvider({ children }: PropsWithChildren) {
  const runtime = useOfflineRuntime();
  const { online, foreground, supported } = useOfflineStatus();
  const { status, userId } = useStore(authSession.status);
  const [service] = useState(() => {
    // Web is a preview without Expo SQLite. Never put medical data in localStorage.
    const memory = new Map<string, ProfileCache>();
    const repository = supported ? runtime.profiles : {
      read: async (id: string) => memory.get(id) ?? null,
      write: async (bundle: ProfileBundle, dirty: boolean) => {
        const previous = memory.get(bundle.profile.id);
        if (previous?.dirty && !dirty) return previous;
        const cache = { bundle, dirty, revision: (previous?.revision ?? 0) + 1 }; memory.set(bundle.profile.id, cache); return cache;
      },
      acknowledge: async (id: string, revision: number) => { const cache = memory.get(id); if (cache?.revision === revision) cache.dirty = false; },
      // The web preview cannot choose a photo, so none is ever pending.
      settlePhoto: async () => {},
      discard: async (revision: number, bundle: ProfileBundle) => {
        if (memory.get(bundle.profile.id)?.revision === revision) memory.set(bundle.profile.id, { bundle, dirty: false, revision: revision + 1 });
      },
      remove: async (id: string) => { memory.delete(id); },
    };
    return createProfileService(repository, profileApi, profilePhotos,
      (id) => authSession.status.getState().status === 'signedIn' && authSession.status.getState().userId === id);
  });
  useProfileCacheInvalidation(service);
  useEffect(() => { void settingsService.start(); }, []);
  useEffect(() => { if (status !== 'unknown') void settingsService.setAccount(status === 'signedIn' ? userId : null); }, [status, userId]);
  useEffect(() => { void service.connect(status === 'signedIn' ? userId : null); return () => { void service.connect(null); }; }, [service, status, userId]);
  useEffect(() => {
    service.setOnline(online === true && foreground);
    if (status !== 'signedIn' || online !== true || !foreground) return;
    if (!userId) {
      let active = true;
      const token = authSession.getTokens()?.accessToken;
      void profileApi.getProfile().then((profile) => { if (active && authSession.getTokens()?.accessToken === token) void authSession.rememberUserId(profile.id); }).catch(() => undefined);
      return () => { active = false; };
    }
    const timer = setInterval(() => { void service.refresh(); }, 30_000);
    const preferences = createPreferencesSync(settingsService.store, userId, profileApi.updatePreferences,
      () => authSession.status.getState().status === 'signedIn' && authSession.status.getState().userId === userId);
    preferences.start();
    return () => { clearInterval(timer); preferences.stop(); };
  }, [foreground, online, service, status, userId]);
  return <ProfileContext value={service}>{children}</ProfileContext>;
}
export function useProfileService() { const value = useContext(ProfileContext); if (!value) throw new Error('Profile provider required.'); return value; }
export function useProfile() {
  const service = useProfileService();
  const state = useStore(service.store);
  const { userId, status } = useStore(authSession.status);
  const query = useProfileCache(service, userId, status === 'signedIn' && userId !== null && state.userId === userId);
  return profileForAccount({ ...state, cache: query.data ?? null, loading: state.loading || (query.isFetching && !query.data),
    error: state.error || query.isError }, userId, status === 'signedIn');
}
