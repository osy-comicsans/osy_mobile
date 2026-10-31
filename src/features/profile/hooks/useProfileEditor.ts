import { useEffect, useRef, useState } from 'react';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { useProfileService } from '../providers/ProfileDataProvider';
import { profileUpdateSchema, type ProfileBundle } from '../types/profile.schemas';

export function useProfileEditor(bundle: ProfileBundle) {
  const service = useProfileService();
  const [draft, setDraft] = useState(() => ({ firstName: bundle.profile.firstName, lastName: bundle.profile.lastName,
    mobileNumber: bundle.profile.mobileNumber, vehicle: bundle.profile.vehicle ?? '', medical: bundle.profile.medical }));
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [failed, setFailed] = useState(false); const [saved, setSaved] = useState(false);
  const staged = useRef(new Set<string>()); const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const files = staged.current;
    return () => {
      active.current = false;
      const latest = service.store.getState().cache?.bundle;
      for (const name of files) {
        if (latest?.pendingPhoto !== name && !latest?.profile.photoUrl?.endsWith(name)) profilePhotos.remove(name);
      }
    };
  }, [service]);
  return { draft, setDraft, photo, saving, failed, saved,
    async choosePhoto() {
      try {
        const next = await profilePhotos.choose(bundle.profile.id); if (!next) return;
        if (!active.current) { profilePhotos.remove(next); return; }
        if (photo) profilePhotos.remove(photo);
        staged.current.add(next); setPhoto(next);
      } catch { if (active.current) setFailed(true); }
    },
    async save() {
      setFailed(false); setSaved(false); setSaving(true);
      try {
        const update = profileUpdateSchema.parse({ ...draft, vehicle: draft.vehicle.trim() || null });
        const latest = service.store.getState().cache?.bundle;
        if (!latest || latest.profile.id !== bundle.profile.id) throw new Error('Account changed.');
        await service.save({ ...latest, profile: { ...latest.profile, ...update }, pendingPhoto: photo ?? latest.pendingPhoto });
        if (active.current) { setPhoto(null); setSaved(true); }
      } catch { if (active.current) setFailed(true); } finally { if (active.current) setSaving(false); }
    },
  };
}
