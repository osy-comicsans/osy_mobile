import { useState } from 'react';

import { api } from '@/common/lib/api/axios';
import { useOfflineRuntime, useOfflineStatus } from '@/common/hooks/use-offline';
import { createId } from '@/common/lib/native/uuid';
import { deleteCapturedFiles, type PickedFile } from '@/features/auth/native/documentCapture';

import { createSafetyApi } from '../api/safetyApi';
import { reportPhotos } from '../native/reportPhotos';
import { nearbyIncidents } from '../nearbyServices';
import { reportPhotoName, toIncidentRequest, type AccidentReportForm } from '../utils/accidentReport';

const safetyApi = createSafetyApi(api);

export type ReportOutcome = 'sending' | 'queued';

export function useReportAccident() {
  const runtime = useOfflineRuntime();
  const status = useOfflineStatus();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (form: AccidentReportForm, photo: PickedFile | null): Promise<ReportOutcome | null> => {
    setSaving(true);
    setFailed(false);
    const report = toIncidentRequest(form, createId(), Date.now());
    void nearbyIncidents.markOwn(report.id);
    const photoName = photo ? reportPhotoName(report.id, photo.mimeType) : null;
    try {
      // The web build has no local database, so it can only send straight away.
      if (!status.supported) {
        await safetyApi.createIncident(report);
        return 'sending';
      }

      if (photo && photoName) reportPhotos.keep(photo.uri, photoName);
      await runtime.reports.save(report, photo && photoName ? { photoName, mimeType: photo.mimeType } : null);
      if (photo) deleteCapturedFiles([photo.uri]);
      await runtime.changed();
      void runtime.sync.requestSync();
      return status.online === true ? 'sending' : 'queued';
    } catch {
      if (photoName && status.supported) reportPhotos.remove(photoName);
      setFailed(true);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { submit, saving, failed, photosSupported: status.supported };
}
