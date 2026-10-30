export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';

export interface SyncOperation {
  sequence: number;
  id: string;
  entity: string;
  entityId: string;
  operation: SyncOperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
  status: SyncStatus;
  nextAttemptAt: number;
}

export interface QueueSummary {
  pending: number;
  failed: number;
  conflicts: number;
}

export interface SyncAdapter {
  // Resolve only after a real server acknowledgement. The backend must dedupe
  // clientOperationId and preserve client-generated entity IDs.
  push(operation: SyncOperation, context: { clientOperationId: string; signal: AbortSignal }): Promise<void>;
  // Optional endpoint-specific pull: normalize responses, then apply them
  // through a repository together with its durable cursor.
  pull?(context: { signal: AbortSignal }): Promise<void>;
}

export class SyncConflictError extends Error {
  constructor(message = 'This change needs manual conflict review.') {
    super(message);
    this.name = 'SyncConflictError';
  }
}
