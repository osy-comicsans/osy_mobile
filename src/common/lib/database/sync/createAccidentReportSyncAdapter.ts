import { isPermanentError } from '../../api/apiError';
import type { IncidentRequest } from '../../../../features/safety/types/safety.schemas';
import type { QueuedReportPhoto } from '../repositories/accidentReportRepository';
import { SyncConflictError, type SyncAdapter } from './syncTypes';

interface AccidentReportTransport {
  createIncident(report: IncidentRequest): Promise<unknown>;
  uploadIncidentPhoto(id: string, photo: { uri: string; mimeType: string }): Promise<void>;
}

interface ReportPhotoStore {
  uriOf(name: string): string | null;
  remove(name: string): void;
}

export function createAccidentReportSyncAdapter(transport: AccidentReportTransport, photos: ReportPhotoStore): SyncAdapter {
  return {
    async push({ operation, entityId, payload }) {
      if (operation === 'create') {
        try {
          await transport.createIncident(payload as unknown as IncidentRequest);
        } catch (error) {
          throw isPermanentError(error) ? new SyncConflictError() : error;
        }
        return;
      }

      const { photoName, mimeType } = payload as unknown as QueuedReportPhoto;
      const uri = photos.uriOf(photoName);
      if (!uri) return;
      try {
        await transport.uploadIncidentPhoto(entityId, { uri, mimeType });
      } catch (error) {
        // The report already arrived, and the photo is optional.
        if (!isPermanentError(error)) throw error;
      }
      photos.remove(photoName);
    },
  };
}
