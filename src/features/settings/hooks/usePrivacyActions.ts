import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authSession } from '@/common/lib/api/axios';
import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { authApi } from '@/features/auth/authServices';
import { useProfileService } from '@/features/profile/providers/ProfileDataProvider';
import { reportPhotos } from '@/features/safety/native/reportPhotos';
import { settingsService } from '../settingsService';
import { defaultSettings } from '../types/settings.types';
import { endHomePreview } from '@/features/auth/utils/previewAccess';
import { profilePhotos } from '@/common/lib/native/profilePhoto';
import { privacyReset } from '@/common/lib/storage/privacyReset';

export function usePrivacyActions() {
  const runtime = useOfflineRuntime(); const { supported } = useOfflineStatus();
  const service = useProfileService(); const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  return { busy, failed, async erase(account: boolean) {
    const userId = authSession.status.getState().userId;
    if (!userId || busy) return false;
    setBusy(true); setFailed(false); runtime.setAuthenticated(false); runtime.setPrivacyBlocked(true);
    let erased = false;
    let intentSaved = false;
    let cleaned = false;
    try {
      await privacyReset.request(userId); intentSaved = true;
      await service.erase(account);
      erased = true;
      if (supported) { await runtime.profiles.purgePersonalData(userId); reportPhotos.clearAll(); }
      await profilePhotos.clearOwner(userId);
      await settingsService.update(defaultSettings);
      queryClient.clear();
      await privacyReset.complete(); cleaned = true;
      if (!account) await service.connect(userId);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'serverAcknowledged' in error && error.serverAcknowledged === true) erased = true;
      setFailed(true); return false;
    }
    finally {
      const acknowledged = erased || service.store.getState().erasureAcknowledged;
      if (!acknowledged && intentSaved) {
        try { await privacyReset.complete(); cleaned = true; } catch { /* Keep sync blocked until startup can finish the intent. */ }
      }
      const currentOwner = authSession.status.getState().userId;
      if (account && acknowledged && (currentOwner === userId || currentOwner === null)) {
        endHomePreview(); await authApi.signOut().catch(() => setFailed(true));
      }
      setBusy(false);
      runtime.setPrivacyBlocked(intentSaved && !cleaned);
      runtime.setAuthenticated(authSession.status.getState().status === 'signedIn');
    }
  } };
}
