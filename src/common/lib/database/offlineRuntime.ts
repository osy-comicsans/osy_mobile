import { createStore } from 'zustand/vanilla';

import { config } from '../config';
import { supportsLocalDatabase } from '../native/appLifecycle';
import { createId } from '../native/uuid';
import { LocalDatabase } from './localDatabase';
import { TodoRepository } from './repositories/todoRepository';
import { WeatherRepository } from './repositories/weatherRepository';
import { getDatabase } from './sqlite';
import { SyncManager } from './sync/syncManager';
import { syncPolicy } from './sync/syncPolicy';
import { SyncQueue } from './sync/syncQueue';
import type { QueueSummary, SyncAdapter } from './sync/syncTypes';

export interface OfflineStatus extends QueueSummary {
  supported: boolean;
  ready: boolean;
  online: boolean | null;
  foreground: boolean;
  syncing: boolean;
  backendConnected: boolean;
  error: string | null;
  syncError: string | null;
  lastSyncAt: number | null;
}

export function createOfflineRuntime() {
  const database = new LocalDatabase(getDatabase);
  const todos = new TodoRepository(database, createId);
  const weather = new WeatherRepository(database);
  const queue = new SyncQueue(database);
  const status = createStore<OfflineStatus>(() => ({
    supported: supportsLocalDatabase, ready: false, online: null, foreground: true,
    syncing: false, backendConnected: false, error: null, syncError: null,
    lastSyncAt: null, pending: 0, failed: 0, conflicts: 0,
  }));
  let invalidate: (() => Promise<void>) | undefined;
  let initialization: Promise<void> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let active = false;
  let authenticated = false;

  const changed = async () => {
    if (!status.getState().ready) return;
    try {
      status.setState({ ...await queue.summary(), error: null });
      await invalidate?.();
    } catch {
      status.setState({ error: 'Could not refresh local data. Try opening Tasks again.' });
    }
  };

  const canSync = () => {
    const current = status.getState();
    return active && authenticated && current.ready && current.online === true && current.foreground
      && config.syncEnabled && config.apiUrl.length > 0;
  };

  const sync = new SyncManager(queue, {
    canSync, onChange: changed,
    onRunning: (syncing) => status.setState({ syncing }),
    onError: (syncError) => status.setState({ syncError }),
    onSuccess: (lastSyncAt) => status.setState({ lastSyncAt }),
  });

  const updateSchedule = () => {
    if (interval) clearInterval(interval);
    interval = undefined;
    status.setState({ backendConnected: config.syncEnabled && config.apiUrl.length > 0 && sync.hasAdapters });
    if (canSync() && sync.hasAdapters) {
      void sync.requestSync();
      interval = setInterval(() => { void sync.requestSync(); }, syncPolicy.foregroundIntervalMs);
    } else {
      sync.cancel();
    }
  };

  const initialize = (): Promise<void> => {
    if (!supportsLocalDatabase || status.getState().ready) return Promise.resolve();
    initialization ??= database.read(async () => undefined)
      .then(() => queue.recoverInterrupted())
      .then(async () => {
        status.setState({ ready: true, error: null });
        await changed();
        updateSchedule();
      })
      .catch((error: unknown) => {
        status.setState({ error: 'Could not open local storage. Your existing data has not been reset.' });
        throw error;
      })
      .finally(() => { initialization = undefined; });
    return initialization;
  };

  return {
    status, todos, weather, queue, sync, initialize, changed,
    start(onChange: () => Promise<void>) {
      active = true;
      invalidate = onChange;
      void initialize().catch(() => undefined);
      updateSchedule();
    },
    stop() {
      active = false;
      invalidate = undefined;
      if (interval) clearInterval(interval);
      interval = undefined;
      sync.cancel();
    },
    setOnline(online: boolean) {
      status.setState({ online });
      updateSchedule();
    },
    setForeground(foreground: boolean) {
      status.setState({ foreground });
      if (foreground) void changed();
      updateSchedule();
    },
    setAuthenticated(signedIn: boolean) {
      authenticated = signedIn;
      updateSchedule();
    },
    registerSyncAdapter(entity: string, adapter: SyncAdapter) {
      sync.register(entity, adapter);
      updateSchedule();
    },
    async syncNow() {
      if (!canSync() || !sync.hasAdapters) return;
      await queue.retryFailed();
      await sync.requestSync();
      await changed();
    },
  };
}

export type OfflineRuntime = ReturnType<typeof createOfflineRuntime>;
