import { useQuery } from '@tanstack/react-query';
import { create } from 'axios';

import { useOfflineStatus } from '@/common/hooks/use-offline';
import { readVehicle } from '@/features/auth/native/documentVault';

import { createVehiclePhotoApi } from '../api/vehiclePhotoApi';
import type { Profile } from '../types/profile.schemas';

const findVehiclePhoto = createVehiclePhotoApi(create());

export function useVehicle(profile: Pick<Profile, 'id' | 'vehicle'> | undefined) {
  const { online } = useOfflineStatus();
  const { data: details = null } = useQuery({
    queryKey: ['vehicle', profile?.id],
    enabled: Boolean(profile),
    queryFn: () => readVehicle(profile?.id ?? ''),
  });
  // A registration's type is often a code, so a model name the driver typed wins.
  const model = (profile?.vehicle || (details ? `${details.brand ?? ''} ${details.type ?? ''}` : '')).trim();
  const { data: photo = null, isFetching: photoLoading } = useQuery({
    queryKey: ['vehicle-photo', model.toLowerCase()],
    enabled: Boolean(model) && online !== false,
    queryFn: ({ signal }) => findVehiclePhoto(model, signal),
    staleTime: Infinity,
  });
  return { details, model, photo, photoLoading };
}
