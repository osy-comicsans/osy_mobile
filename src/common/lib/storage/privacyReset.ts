import { preferenceStorage } from './preferenceStorage';

const KEY = 'osy.privacy.pendingErase';
// A non-secret, durable deletion intent. Startup clears older device-local
// queues before enabling sync, so erased data cannot be uploaded after a crash.
export const privacyReset = {
  read: () => preferenceStorage.getItem(KEY),
  request: (userId: string) => preferenceStorage.setItem(KEY, userId),
  complete: () => preferenceStorage.setItem(KEY, ''),
};
