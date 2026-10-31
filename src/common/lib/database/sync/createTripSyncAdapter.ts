import { isPermanentError } from '../../api/apiError';
import type { TripUpload } from '../../../../features/profile/types/profile.schemas';
import type { QueuedTrip } from '../repositories/tripRepository';
import { SyncConflictError, type SyncAdapter } from './syncTypes';

interface TripTransport {
  recordTrip(trip: TripUpload, owner: string): Promise<void>;
}

// A trip is only sent for its owner: with another account signed in the request
// is canceled, and the trip waits for its owner to return.
export function createTripSyncAdapter(transport: TripTransport): SyncAdapter {
  return {
    async push({ payload }) {
      const { owner, ...trip } = payload as unknown as QueuedTrip;
      try {
        await transport.recordTrip(trip, owner);
      } catch (error) {
        throw isPermanentError(error) ? new SyncConflictError() : error;
      }
    },
  };
}
