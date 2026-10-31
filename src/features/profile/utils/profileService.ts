import { createStore } from 'zustand/vanilla';
import type { ProfileRepository, ProfileCache } from '@/common/lib/database/repositories/profileRepository';
import type { createProfileApi } from '../api/profileApi';
import { profileBundleSchema, type ProfileBundle } from '../types/profile.schemas';

type ProfileApi = ReturnType<typeof createProfileApi>;
export interface ProfileState { cache: ProfileCache | null; loading: boolean; syncing: boolean; error: boolean; erasureAcknowledged: boolean }
export function profileForAccount(state: ProfileState, userId: string | null, signedIn: boolean) {
  const matches = signedIn && userId !== null && state.cache?.bundle.profile.id === userId;
  return { ...state, cache: matches ? state.cache : null, authenticated: signedIn,
    loading: signedIn && (state.loading || (state.cache !== null && !matches)) };
}
export function createProfileService(repository: Pick<ProfileRepository, 'read' | 'write' | 'acknowledge' | 'remove'>, api: ProfileApi,
  photos?: { uriOf(name: string): string | null; remove(name: string): void }, isCurrentOwner: (id: string) => boolean = () => true) {
  const store = createStore<ProfileState>(() => ({ cache: null, loading: false, syncing: false, error: false, erasureAcknowledged: false }));
  let owner: string | null = null;
  let generation = 0;
  let online = false;
  let busy = false;
  let acknowledgedDeletion: boolean | null = null;
  const valid = (id: number, userId: string) => generation === id && owner === userId && isCurrentOwner(userId);

  async function refresh() {
    if (!owner || !online || busy) return;
    const id = generation; const userId = owner;
    busy = true; let sentRevision = -1; let succeeded = false;
    store.setState({ syncing: true });
    try {
      const cached = await repository.read(userId);
      if (!valid(id, userId)) return;
      if (cached?.dirty) {
        sentRevision = cached.revision;
        let photoUrl: string | undefined;
        if (cached.bundle.pendingPhoto) {
          const uri = photos?.uriOf(cached.bundle.pendingPhoto);
          if (!uri) throw new Error('Saved photo unavailable.');
          photoUrl = (await api.uploadPhoto(uri, cached.bundle.pendingPhoto)).photoUrl;
          if (!valid(id, userId)) return;
        }
        const saved = await api.updateProfile(cached.bundle.profile);
        if (JSON.stringify(saved.medical) !== JSON.stringify(cached.bundle.profile.medical) || saved.vehicle !== cached.bundle.profile.vehicle) {
          throw new Error('Backend did not acknowledge the profile fields.');
        }
        if (!valid(id, userId)) return;
        await api.replaceEmergencyContacts(cached.bundle.contacts);
        if (!valid(id, userId)) return;
        await repository.acknowledge(userId, sentRevision, photoUrl);
        if (cached.bundle.pendingPhoto && photoUrl && !photoUrl.startsWith('file:')) {
          const latest = await repository.read(userId);
          if (latest?.bundle.pendingPhoto !== cached.bundle.pendingPhoto) photos?.remove(cached.bundle.pendingPhoto);
        }
      }
      const results = await Promise.allSettled([api.getProfile(), api.getEmergencyContacts(), api.getDrivingStats(), api.getReports()]);
      if (!valid(id, userId)) return;
      const [profile, contacts, stats, reports] = results;
      if (profile.status !== 'fulfilled' || contacts.status !== 'fulfilled' || profile.value.id !== userId) throw new Error('Profile unavailable.');
      const previous = await repository.read(userId);
      const bundle: ProfileBundle = {
        profile: profile.value, contacts: contacts.value.contacts,
        stats: stats.status === 'fulfilled' ? stats.value : previous?.bundle.stats ?? null,
        reports: reports.status === 'fulfilled' ? reports.value.reports : previous?.bundle.reports ?? [],
        pendingPhoto: null,
        historyAvailable: reports.status === 'fulfilled' || (previous?.bundle.historyAvailable ?? false),
      };
      if (!valid(id, userId)) return;
      const cache = await repository.write(bundle, false);
      if (valid(id, userId)) store.setState({ cache, error: false });
      succeeded = true;
    } catch { if (valid(id, userId)) store.setState({ error: true }); }
    finally {
      if (valid(id, userId)) {
        busy = false; store.setState({ syncing: false, loading: false });
        const latest = store.getState().cache;
        if (succeeded && latest?.dirty && latest.revision > sentRevision) void refresh();
      }
    }
  }
  return {
    store, refresh,
    async connect(userId: string | null) {
      const id = ++generation; owner = userId; busy = false;
      acknowledgedDeletion = null;
      store.setState({ cache: null, loading: Boolean(userId), error: false, syncing: false, erasureAcknowledged: false });
      if (!userId) return;
      try {
        const cache = await repository.read(userId);
        if (valid(id, userId)) store.setState({ cache, loading: false });
      } catch { if (valid(id, userId)) store.setState({ loading: false, error: true }); }
      if (valid(id, userId)) void refresh();
    },
    setOnline(value: boolean) { online = value; if (value) void refresh(); },
    async save(bundle: ProfileBundle) {
      if (!owner || bundle.profile.id !== owner || !isCurrentOwner(owner)) throw new Error('Profile owner mismatch.');
      const id = generation; const userId = owner;
      const cache = await repository.write(profileBundleSchema.parse(bundle), true);
      if (valid(id, userId)) { store.setState({ cache, error: false }); void refresh(); }
    },
    async erase(account: boolean) {
      if (!owner || !online || busy || !isCurrentOwner(owner)) throw new Error('Connect before deleting.');
      const id = generation; const userId = owner; busy = true;
      let acknowledged = false;
      store.setState({ syncing: true });
      try {
        if (acknowledgedDeletion !== account) {
          if (account) await api.deleteAccount(); else await api.deleteData();
          if (generation === id && owner === userId) acknowledgedDeletion = account;
        }
        acknowledged = true;
        if (!valid(id, userId)) throw new Error('Account changed.');
        store.setState({ erasureAcknowledged: true });
        await repository.remove(userId);
        store.setState({ cache: null });
      } catch (error) {
        if (acknowledged) throw Object.assign(error instanceof Error ? error : new Error('Local erasure incomplete.'), { serverAcknowledged: true });
        throw error;
      } finally { if (valid(id, userId)) { busy = false; store.setState({ syncing: false }); } }
    },
  };
}
export type ProfileService = ReturnType<typeof createProfileService>;
