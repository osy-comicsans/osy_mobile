import type { SyncOperation } from '@/common/lib/database/sync/syncTypes';
import type { RemoteTodo } from '../types/todo';

// Implement this contract with the shared Axios client when endpoints exist.
// No URLs, credentials, fake acknowledgements, or requests are supplied now.
export interface TodosTransport {
  push(operation: SyncOperation, context: { clientOperationId: string; signal: AbortSignal }): Promise<void>;
  pull?(cursor: string | null, context: { signal: AbortSignal }): Promise<{
    changes: RemoteTodo[];
    cursor: string | null;
  }>;
}
