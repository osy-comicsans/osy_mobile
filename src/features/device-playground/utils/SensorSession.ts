import type { Removable, SensorDriver, SensorSnapshot } from '../types/sensor.types';
import { UI_INTERVAL_MS } from './sensor.utils';

// One cancellable subscription per test. Pure lifecycle code is kept outside
// React so permission races, late subscriptions, and throttling can be tested.
export class SensorSession<T> {
  private snapshot: SensorSnapshot<T> = {
    phase: 'stopped', permission: null, available: null, data: null,
    updatedAt: null, refreshing: false, error: null, notice: null,
  };
  private listeners = new Set<() => void>();
  private subscription: Removable | null = null;
  private generation = 0;
  private readGeneration = 0;
  private active = false;
  private pending: { data: T; at: number } | null = null;
  private updateTimer: ReturnType<typeof setTimeout> | undefined;
  private sampleTimer: ReturnType<typeof setTimeout> | undefined;
  private readTimer: ReturnType<typeof setTimeout> | undefined;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private lastPublishedAt = -Infinity;

  constructor(private readonly driver: SensorDriver<T>, private readonly now = Date.now) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private patch(patch: Partial<SensorSnapshot<T>>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  setActive(active: boolean) { this.active = active; if (!active) this.stop(); }

  start = async (): Promise<void> => {
    if (!this.active || this.snapshot.phase === 'starting' || this.snapshot.phase === 'running' || this.snapshot.refreshing) return;
    const generation = ++this.generation;
    this.lastPublishedAt = -Infinity;
    this.patch({ phase: 'starting', error: null, notice: null, data: null, updatedAt: null });
    try {
      if (!(await this.authorize(() => generation === this.generation && this.active))) return;
      if (generation !== this.generation || !this.active) return;
      // Start the watchdog before awaiting a native subscription: cancellation
      // still removes a subscription that resolves after Stop or navigation.
      if (this.driver.firstSampleTimeoutMs) {
        this.sampleTimer = setTimeout(() => this.fail(
          generation, new Error(this.driver.timeoutMessage ?? 'No sensor samples arrived. Check device support and permissions.'),
        ), this.driver.firstSampleTimeoutMs);
      }
      const subscription = await this.driver.subscribe(
        (data) => this.receive(generation, data), (error) => this.fail(generation, error),
      );
      if (generation !== this.generation || !this.active) { subscription.remove(); return; }
      this.subscription = subscription;
      this.patch({ phase: 'running' });
    } catch (error) { this.fail(generation, error); }
  };

  stop = (): void => {
    this.generation++;
    this.readGeneration++;
    this.cleanup();
    if (this.snapshot.phase === 'running' || this.snapshot.phase === 'starting' || this.snapshot.refreshing) {
      this.patch({ phase: 'stopped', refreshing: false, notice: null });
    } else if (this.snapshot.notice) this.patch({ notice: null });
  };

  refresh = async (): Promise<void> => {
    if (!this.driver.read || !this.active || this.snapshot.refreshing || this.snapshot.phase === 'starting') return;
    const readGeneration = ++this.readGeneration;
    const generation = this.generation;
    const current = () => readGeneration === this.readGeneration && generation === this.generation && this.active;
    this.patch({ refreshing: true, error: null });
    this.readTimer = setTimeout(() => {
      if (current()) this.fail(generation, new Error('A location fix took too long. Check location services and try outdoors.'));
    }, 30_000);
    try {
      if (!(await this.authorize(current))) return;
      if (!current()) return;
      const data = await this.driver.read();
      if (current()) this.patch({ data, updatedAt: this.now(), refreshing: false, phase: this.snapshot.phase === 'running' ? 'running' : 'stopped' });
    } catch (error) { if (current()) this.fail(generation, error); }
    finally {
      if (readGeneration === this.readGeneration) {
        clearTimeout(this.readTimer);
        this.readTimer = undefined;
        if (this.snapshot.refreshing) this.patch({ refreshing: false });
      }
    }
  };

  replaceData(data: T): void { this.pending = null; this.patch({ data }); }
  clearNotice(): void { clearTimeout(this.noticeTimer); this.noticeTimer = undefined; this.patch({ notice: null }); }
  showNotice(notice: string, duration = 1_200): void {
    clearTimeout(this.noticeTimer);
    this.patch({ notice });
    this.noticeTimer = setTimeout(() => { this.noticeTimer = undefined; this.patch({ notice: null }); }, duration);
  }

  private async authorize(current: () => boolean): Promise<boolean> {
    const available = await this.driver.available();
    if (!current()) return false;
    this.patch({ available });
    if (!available) { this.stop(); this.patch({ phase: 'unavailable', error: this.driver.unavailableMessage }); return false; }
    let permission = await this.driver.getPermission();
    if (!current()) return false;
    if (!permission.granted && permission.canAskAgain) permission = await this.driver.requestPermission();
    if (!current()) return false;
    this.patch({ permission });
    if (!permission.granted) {
      this.stop();
      this.patch({ phase: 'denied', error: permission.canAskAgain ? 'Permission was not granted. You can try Start again.' : 'Permission denied. Enable it in system Settings, then return and press Start.' });
      return false;
    }
    return true;
  }

  private receive(generation: number, data: T) {
    if (generation !== this.generation || !this.active) return;
    clearTimeout(this.sampleTimer);
    this.sampleTimer = undefined;
    const at = this.now();
    this.pending = { data, at };
    const remaining = UI_INTERVAL_MS - (at - this.lastPublishedAt);
    if (remaining <= 0) this.flush();
    else if (!this.updateTimer) this.updateTimer = setTimeout(() => this.flush(), remaining);
  }
  private flush() {
    clearTimeout(this.updateTimer);
    this.updateTimer = undefined;
    if (!this.pending) return;
    const { data, at } = this.pending;
    this.pending = null;
    this.lastPublishedAt = this.now();
    this.patch({ data, updatedAt: at });
  }
  private fail(generation: number, error: unknown) {
    if (generation !== this.generation || !this.active) return;
    this.generation++;
    this.readGeneration++;
    this.cleanup();
    this.patch({ phase: 'error', refreshing: false, notice: null, error: error instanceof Error ? error.message : String(error) });
  }
  private cleanup() {
    this.subscription?.remove();
    this.subscription = null;
    for (const timer of [this.updateTimer, this.sampleTimer, this.readTimer, this.noticeTimer]) clearTimeout(timer);
    this.updateTimer = this.sampleTimer = this.readTimer = this.noticeTimer = undefined;
    this.pending = null;
  }
}
