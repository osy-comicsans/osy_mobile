export const STARTUP_TIMEOUT_MS = 4_000;

export type StartupTask = 'fonts' | 'session' | 'direction';
type TaskStatus = 'pending' | 'ready' | 'failed';
export interface StartupSnapshot {
  tasks: Record<StartupTask, TaskStatus>;
  contentReady: boolean;
  artworkReady: boolean;
  emergency: boolean;
  timedOut: boolean;
  ready: boolean;
}

// Query/hash values must not let an ordinary route bypass startup. Both custom
// schemes and Expo development URLs can put check-in after a host or /--/.
export function isEmergencyPath(value: string | null | undefined): boolean {
  if (!value) return false;
  const path = value.split(/[?#]/, 1)[0];
  try { return /(?:^|\/)check-in\/?$/.test(decodeURIComponent(path)); }
  catch { return false; }
}

export class StartupCoordinator {
  private snapshot: StartupSnapshot;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private work = new Map<StartupTask, Promise<unknown>>();
  private generation = 0;

  constructor(private readonly tasks: Record<StartupTask, () => Promise<unknown>>, initialPath?: string) {
    this.snapshot = {
      tasks: { fonts: 'pending', session: 'pending', direction: 'pending' },
      contentReady: false, artworkReady: false, emergency: isEmergencyPath(initialPath), timedOut: false, ready: false,
    };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  start() {
    const generation = ++this.generation;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.patch({ timedOut: true }), STARTUP_TIMEOUT_MS);
    for (const task of Object.keys(this.tasks) as StartupTask[]) {
      if (!this.work.has(task)) this.work.set(task, Promise.resolve().then(this.tasks[task]));
      void this.work.get(task)!.then(
        () => { if (generation === this.generation) this.setTask(task, 'ready'); },
        () => { if (generation === this.generation) this.setTask(task, 'failed'); },
      );
    }
  }
  stop() { this.generation++; clearTimeout(this.timer); }
  markContentReady = () => { if (!this.snapshot.contentReady) this.patch({ contentReady: true }); };
  markArtworkReady = () => { if (!this.snapshot.artworkReady) this.patch({ artworkReady: true }); };
  prioritizeEmergency = (path: string | null | undefined) => {
    if (isEmergencyPath(path) && !this.snapshot.emergency) this.patch({ emergency: true });
  };
  private setTask(task: StartupTask, status: TaskStatus) {
    this.patch({ tasks: { ...this.snapshot.tasks, [task]: status } });
  }
  private patch(update: Partial<StartupSnapshot>) {
    const next = { ...this.snapshot, ...update };
    const settled = Object.values(next.tasks).every((status) => status !== 'pending');
    next.ready = next.ready || next.timedOut || (next.contentReady && (next.emergency || (settled && next.artworkReady)));
    this.snapshot = next;
    if (next.ready) clearTimeout(this.timer);
    for (const listener of this.listeners) listener();
  }
}
