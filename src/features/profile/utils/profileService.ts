import type { ProfileCache } from '@/common/lib/database/repositories/profileRepository';
export { createProfileSyncManager as createProfileService } from '@/common/lib/database/sync/profileSyncManager';
export type { ProfileSyncManager as ProfileService } from '@/common/lib/database/sync/profileSyncManager';

interface ProfileProjection { cache: ProfileCache | null; loading: boolean; syncing: boolean; error: boolean }
export function profileForAccount(state: ProfileProjection, userId: string | null, signedIn: boolean) {
  const matches = signedIn && userId !== null && state.cache?.bundle.profile.id === userId;
  return { ...state, cache: matches ? state.cache : null, authenticated: signedIn,
    loading: signedIn && (state.loading || (state.cache !== null && !matches)) };
}
