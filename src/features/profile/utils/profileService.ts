import type { ProfileCache } from '@/common/lib/database/repositories/profileRepository';
import type { ProfileRejection } from '@/common/lib/database/sync/profileSyncManager';
export { createProfileSyncManager as createProfileService } from '@/common/lib/database/sync/profileSyncManager';
export type { ProfileSyncManager as ProfileService, ProfileRejection } from '@/common/lib/database/sync/profileSyncManager';

interface ProfileProjection { cache: ProfileCache | null; loading: boolean; syncing: boolean; error: boolean; rejection?: ProfileRejection | null }
export function profileForAccount(state: ProfileProjection, userId: string | null, signedIn: boolean) {
  const matches = signedIn && userId !== null && state.cache?.bundle.profile.id === userId;
  const cache = matches ? state.cache : null;
  return { ...state, cache, authenticated: signedIn,
    loading: signedIn && (state.loading || (state.cache !== null && !matches)),
    // A newer edit replaces the refused one, so only the refused revision needs attention.
    rejection: cache?.dirty && state.rejection?.revision === cache.revision ? state.rejection : null };
}

export const rejectedFieldLabels = {
  firstName: 'auth.firstName', lastName: 'auth.lastName', mobileNumber: 'auth.mobileNumber', vehicle: 'account.vehicle',
  medical: 'account.medical', contacts: 'profile.emergencyContacts', photo: 'account.photo',
} as const;
export type RejectedField = keyof typeof rejectedFieldLabels;

// Server error fields can be paths, such as contacts.0.mobileNumber, so they are grouped by their first part.
export function rejectedFields(rejection: ProfileRejection | null): RejectedField[] {
  const roots = (rejection?.fields ?? []).map((field) => field.split('.')[0]);
  return Object.keys(rejectedFieldLabels).filter((field): field is RejectedField => roots.includes(field));
}
