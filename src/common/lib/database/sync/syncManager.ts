import { getRetryDelay, syncPolicy } from './syncPolicy';
import type { SyncQueue } from './syncQueue';
import { SyncConflictError, type SyncAdapter } from './syncTypes';

interface SyncManagerOptions {
  canSync: () => boolean;
  onChange: () => Promise<void>;
  onRunning: (running: boolean) => void;
  onError: (message: string | null) => void;
  onSuccess: (timestamp: number) => void;
  now?: () => number;
  random?: () => number;
}

export class SyncManager {
  private readonly adapters = new Map<string, SyncAdapter>();
  private inFlight: Promise<void> | undefined;
  private requested = false;
  private controller: AbortController | undefined;
  private readonly now: () => number;
  private pullRetryAt = 0;
  private pullRetries = 0;

  constructor(private readonly queue: SyncQueue, private readonly options: SyncManagerOptions) {
    this.now = options.now ?? Date.now;
  }

  register(entity: string, adapter: SyncAdapter): void {
    this.adapters.set(entity, adapter);
  }

  get hasAdapters(): boolean {
    return this.adapters.size > 0;
  }

  cancel(): void {
    this.controller?.abort();
    this.requested = false;
  }

  requestSync(): Promise<void> {
    if (!this.options.canSync() || !this.hasAdapters) return Promise.resolve();
    if (this.inFlight) {
      this.requested = true;
      return this.inFlight;
    }

    this.inFlight = this.drain().catch(() => {
      this.options.onError('Could not sync. Your changes remain saved on this device.');
    }).finally(() => {
      this.inFlight = undefined;
      this.options.onRunning(false);
    });
    return this.inFlight;
  }

  private async drain(): Promise<void> {
    this.options.onRunning(true);
    this.options.onError(null);
    this.controller = new AbortController();
    const signal = this.controller.signal;
    do {
      this.requested = false;
      for (let index = 0; index < syncPolicy.batchSize && this.options.canSync() && !signal.aborted; index++) {
        const operation = await this.queue.claimNext(this.now(), [...this.adapters.keys()]);
        if (!operation) break;
        if (!this.options.canSync() || signal.aborted) {
          await this.queue.release(operation.id);
          await this.options.onChange();
          break;
        }
        try {
          await this.adapters.get(operation.entity)!.push(operation, {
            clientOperationId: operation.id, signal,
          });
          // Never replace local data with the older request snapshot. A newer
          // local edit may have been committed while this request was in flight.
          await this.queue.complete(operation.id);
          this.options.onSuccess(this.now());
        } catch (error) {
          const conflict = error instanceof SyncConflictError;
          await this.queue.fail(
            operation.id,
            conflict ? 'Manual conflict review is required.' : 'The server has not confirmed this change.',
            this.now() + getRetryDelay(operation.retryCount + 1, this.options.random), conflict,
          );
          this.options.onError(conflict ? 'A change needs conflict review.' : 'Some changes are waiting to retry.');
        }
        await this.options.onChange();
      }

      if (this.options.canSync() && !signal.aborted && this.now() >= this.pullRetryAt) {
        try {
          for (const adapter of this.adapters.values()) {
            if (adapter.pull) {
              await adapter.pull({ signal });
              this.options.onSuccess(this.now());
            }
          }
          this.pullRetries = 0;
          this.pullRetryAt = 0;
          await this.options.onChange();
        } catch {
          this.pullRetryAt = this.now() + getRetryDelay(++this.pullRetries, this.options.random);
          this.options.onError('Could not refresh from the server. Your local tasks are available.');
        }
      }
    } while (this.requested && this.options.canSync() && !signal.aborted);
  }
}
