import { useEffect, useRef, useState } from 'react';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { useProfileService } from '../providers/ProfileDataProvider';
import { profileUpdateSchema, type Profile, type ProfileBundle } from '../types/profile.schemas';

const editable = ({ firstName, lastName, mobileNumber, vehicle, medical }: Profile) => ({ firstName, lastName, mobileNumber, vehicle: vehicle ?? '', medical });
const same = (a: ReturnType<typeof editable>, b: ReturnType<typeof editable>) => JSON.stringify(a) === JSON.stringify(b);

export function useProfileEditor(bundle: ProfileBundle) {
  const service = useProfileService();
  const latest = editable(bundle.profile);
  const [base, setBase] = useState(latest); const [draft, setDraft] = useState(latest);
  // Without unsaved edits the form follows the cache, so saving never sends back older values.
  if (!same(latest, base)) { setBase(latest); if (same(draft, base)) setDraft(latest); }
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [failed, setFailed] = useState(false); const [saved, setSaved] = useState(false);
  const staged = useRef(new Set<string>()); const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const files = staged.current;
    return () => {
      active.current = false;
      for (const name of files) void service.releasePhoto(bundle.profile.id, name);
    };
  }, [bundle.profile.id, service]);
  return { draft, setDraft, photo, saving, failed, saved,
    async choosePhoto() {
      try {
        const next = await profilePhotos.choose(bundle.profile.id); if (!next) return;
        if (!active.current) { profilePhotos.remove(next); return; }
        if (photo) await service.releasePhoto(bundle.profile.id, photo);
        staged.current.add(next); setPhoto(next);
      } catch { if (active.current) setFailed(true); }
    },
    async save() {
      setFailed(false); setSaved(false); setSaving(true);
      const submitted = draft;
      try {
        const update = profileUpdateSchema.parse({ ...submitted, vehicle: submitted.vehicle.trim() || null });
        const latestCache = (await service.read())?.bundle;
        if (!latestCache || latestCache.profile.id !== bundle.profile.id) throw new Error('Account changed.');
        const profile = { ...latestCache.profile, ...update };
        await service.save({ ...latestCache, profile, pendingPhoto: photo ?? latestCache.pendingPhoto });
        if (active.current) {
          // Shows the saved, trimmed values unless the user kept typing.
          setDraft((current) => same(current, submitted) ? editable(profile) : current);
          setPhoto(null); setSaved(true);
        }
      } catch { if (active.current) setFailed(true); } finally { if (active.current) setSaving(false); }
    },
  };
}
