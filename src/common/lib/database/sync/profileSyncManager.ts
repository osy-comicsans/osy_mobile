import { createStore } from 'zustand/vanilla';
import { isPermanentError, type ApiErrorKind } from '../../api/apiError';
import type { ProfileRepository } from '../repositories/profileRepository';
import type { createProfileApi } from '../../../../features/profile/api/profileApi';
import { profileBundleSchema, type ProfileBundle } from '../../../../features/profile/types/profile.schemas';

type ProfileApi = ReturnType<typeof createProfileApi>;
// A change the server refused. It stays on the phone until the user edits, retries or discards it.
export interface ProfileRejection { revision: number; kind: ApiErrorKind; fields: string[] }
export interface ProfileState { revision: number; userId: string | null; loading: boolean; syncing: boolean; error: boolean; erasureAcknowledged: boolean; rejection: ProfileRejection | null }
export function createProfileSyncManager(repository: Pick<ProfileRepository, 'read' | 'write' | 'acknowledge' | 'settlePhoto' | 'discard' | 'remove'>, api: ProfileApi,
  photos?: { uriOf(name: string): string | null; remove(name: string): void; clearOwner(owner: string): Promise<void> }, isCurrentOwner: (id: string) => boolean = () => true) {
  const store = createStore<ProfileState>(() => ({ revision: 0, userId: null, loading: false, syncing: false, error: false, erasureAcknowledged: false, rejection: null }));
  let owner: string | null = null;
  let generation = 0;
  let online = false;
  let busy = false;
  let acknowledgedDeletion: boolean | null = null;
  const valid = (id: number, userId: string) => generation === id && owner === userId && isCurrentOwner(userId);

  // Resolves false once the account changed, so nothing more is sent for it.
  async function push({ profile, contacts, pendingPhoto }: ProfileBundle, id: number, userId: string) {
    if (pendingPhoto) {
      // A photo file that no longer exists cannot be sent, so the rest of the change goes without it.
      const uri = photos?.uriOf(pendingPhoto);
      const photoUrl = uri ? (await api.uploadPhoto(uri, pendingPhoto)).photoUrl : null;
      if (!valid(id, userId)) return false;
      // Kept at once, so a later failure does not upload the photo again.
      await repository.settlePhoto(userId, pendingPhoto, photoUrl);
      if (photoUrl && !photoUrl.startsWith('file:')) photos?.remove(pendingPhoto);
      if (valid(id, userId)) store.setState((state) => ({ revision: state.revision + 1 }));
    }
    const saved = await api.updateProfile(profile);
    if (JSON.stringify(saved.medical) !== JSON.stringify(profile.medical) || saved.vehicle !== profile.vehicle) {
      throw new Error('Backend did not acknowledge the profile fields.');
    }
    if (!valid(id, userId)) return false;
    await api.replaceEmergencyContacts(contacts);
    return valid(id, userId);
  }

  async function download(userId: string): Promise<ProfileBundle> {
    const [profile, contacts, stats, reports] = await Promise.allSettled([api.getProfile(), api.getEmergencyContacts(), api.getDrivingStats(), api.getReports()]);
    if (profile.status !== 'fulfilled' || contacts.status !== 'fulfilled' || profile.value.id !== userId) throw new Error('Profile unavailable.');
    const previous = await repository.read(userId);
    return {
      profile: profile.value, contacts: contacts.value.contacts,
      stats: stats.status === 'fulfilled' ? stats.value : previous?.bundle.stats ?? null,
      reports: reports.status === 'fulfilled' ? reports.value.reports : previous?.bundle.reports ?? [],
      pendingPhoto: null,
      historyAvailable: reports.status === 'fulfilled' || (previous?.bundle.historyAvailable ?? false),
    };
  }

  async function refresh() {
    if (!owner || !online || busy) return;
    const id = generation; const userId = owner;
    busy = true; let sentRevision = -1; let pendingRevision = -1; let succeeded = false;
    store.setState({ syncing: true });
    try {
      const cached = await repository.read(userId);
      if (!valid(id, userId)) return;
      if (cached?.dirty) {
        // Sending a refused change again would fail the same way.
        if (cached.revision === store.getState().rejection?.revision) return;
        sentRevision = cached.revision;
        try {
          if (!await push(cached.bundle, id, userId)) return;
        } catch (error) {
          if (!isPermanentError(error)) throw error;
          if (valid(id, userId)) store.setState({ error: false, rejection: { revision: sentRevision, kind: error.kind, fields: Object.keys(error.fields) } });
          return;
        }
        await repository.acknowledge(userId, sentRevision);
      }
      const bundle = await download(userId);
      if (!valid(id, userId)) return;
      const cache = await repository.write(bundle, false);
      pendingRevision = cache.dirty ? cache.revision : -1;
      if (valid(id, userId)) store.setState((state) => ({ revision: state.revision + 1, error: false, rejection: null }));
      succeeded = true;
    } catch { if (valid(id, userId)) store.setState({ error: true }); }
    finally {
      if (valid(id, userId)) {
        busy = false; store.setState({ syncing: false, loading: false });
        if (succeeded && pendingRevision > sentRevision) void refresh();
      }
    }
  }

  async function releasePhoto(userId: string, name: string) {
    try {
      const cache = await repository.read(userId);
      if (cache?.bundle.pendingPhoto !== name && !cache?.bundle.profile.photoUrl?.endsWith(name)) photos?.remove(name);
    } catch { /* Keep the file when storage cannot confirm that it is unreferenced. */ }
  }

  return {
    store, refresh, releasePhoto,
    async read(expectedOwner: string | null = owner) {
      if (!expectedOwner || expectedOwner !== owner || !isCurrentOwner(expectedOwner)) return null;
      const id = generation;
      const cache = await repository.read(expectedOwner);
      return valid(id, expectedOwner) ? cache : null;
    },
    async connect(userId: string | null) {
      const id = ++generation; owner = userId; busy = false;
      acknowledgedDeletion = null;
      store.setState((state) => ({ revision: state.revision + 1, userId, loading: Boolean(userId), error: false, syncing: false, erasureAcknowledged: false, rejection: null }));
      if (!userId) return;
      try {
        await repository.read(userId);
        if (valid(id, userId)) store.setState((state) => ({ revision: state.revision + 1, loading: false }));
      } catch { if (valid(id, userId)) store.setState({ loading: false, error: true }); }
      if (valid(id, userId)) void refresh();
    },
    setOnline(value: boolean) { online = value; if (value) void refresh(); },
    async save(bundle: ProfileBundle) {
      if (!owner || bundle.profile.id !== owner || !isCurrentOwner(owner)) throw new Error('Profile owner mismatch.');
      const id = generation; const userId = owner;
      await repository.write(profileBundleSchema.parse(bundle), true);
      if (valid(id, userId)) { store.setState((state) => ({ revision: state.revision + 1, error: false })); void refresh(); }
    },
    // Sends a refused change again, for when the server may accept it now.
    retry() { store.setState({ rejection: null }); return refresh(); },
    // Drops unsent edits for the account's saved copy, which only the server has.
    async discard() {
      if (!owner || !online || busy || !isCurrentOwner(owner)) throw new Error('Connect before discarding.');
      const id = generation; const userId = owner; busy = true;
      store.setState({ syncing: true });
      try {
        const cached = await repository.read(userId);
        const bundle = await download(userId);
        if (!cached || !valid(id, userId)) throw new Error('Account changed.');
        await repository.discard(cached.revision, bundle);
        if (cached.bundle.pendingPhoto) await releasePhoto(userId, cached.bundle.pendingPhoto);
        if (valid(id, userId)) store.setState((state) => ({ revision: state.revision + 1, error: false, rejection: null }));
      } finally { if (valid(id, userId)) { busy = false; store.setState({ syncing: false }); } }
    },
    // Sends unsynced edits without the extra reads, for when the backend copy is about to be used.
    async syncPending() {
      const cache = owner ? await repository.read(owner).catch(() => null) : null;
      if (cache?.dirty) await refresh();
    },
    // Signing out leaves no profile, medical details, contacts or photos on the phone.
    async forget(userId: string) {
      await Promise.all([repository.remove(userId), photos?.clearOwner(userId)]);
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
        store.setState((state) => ({ revision: state.revision + 1 }));
      } catch (error) {
        if (acknowledged) throw Object.assign(error instanceof Error ? error : new Error('Local erasure incomplete.'), { serverAcknowledged: true });
        throw error;
      } finally { if (valid(id, userId)) { busy = false; store.setState({ syncing: false }); } }
    },
  };
}
export type ProfileSyncManager = ReturnType<typeof createProfileSyncManager>;
