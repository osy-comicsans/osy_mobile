import type { SensorId, SensorPhase } from '../types/sensor.types';

export class PlaygroundRegistry {
  private phases: Record<SensorId, SensorPhase> = {
    gps: 'stopped', accelerometer: 'stopped', gyroscope: 'stopped', motion: 'stopped', shake: 'stopped', pedometer: 'stopped',
  };
  private listeners = new Set<() => void>();
  private stoppers = new Map<SensorId, () => void>();
  getSnapshot = () => this.phases;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  update(id: SensorId, phase: SensorPhase) {
    if (this.phases[id] === phase) return;
    this.phases = { ...this.phases, [id]: phase };
    for (const listener of this.listeners) listener();
  }
  register(id: SensorId, stop: () => void) {
    this.stoppers.set(id, stop);
    return () => { this.stoppers.delete(id); this.update(id, 'stopped'); };
  }
  stopAll = () => { for (const stop of this.stoppers.values()) stop(); };
}
