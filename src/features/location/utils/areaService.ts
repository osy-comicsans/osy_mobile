import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AreaCache, AreaState, GeocodedArea } from '../types/area.types';
import type { LocationState } from '../types/location.types';
import { areaPolicy } from './areaPolicy';

export function areaCell(latitude: number, longitude: number) {
  const lat = Math.min(17999, Math.floor((latitude + 90) * 100));
  const lon = Math.min(35999, Math.floor(((longitude === 180 ? -180 : longitude) + 180) * 100));
  return {
    key: `area-v1:${lat}:${lon}`,
    latitude: Number((lat / 100 - 90 + 0.005).toFixed(6)),
    longitude: Number((lon / 100 - 180 + 0.005).toFixed(6)),
  };
}

export function areaLabel(address: GeocodedArea | null) {
  const parts = [address?.district, address?.city, address?.region].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join(' · ').slice(0, 160) || null;
}

export function createAreaService(
  location: StoreApi<LocationState>, cache: AreaCache,
  lookup: (point: { latitude: number; longitude: number }) => Promise<GeocodedArea | null>,
  now: () => number = Date.now,
) {
  const store = createStore<AreaState>(() => ({ area: null, loading: false, stale: false }));
  let unsubscribe: (() => void) | undefined;
  let online = false;
  let generation = 0;
  let inFlight = false;
  let wanted: string | null = null;
  let lastReadKey: string | null = null;
  let lastLookupAt = -Infinity;

  const sync = (state: LocationState) => {
    const fix = state.fix;
    const valid = state.status === 'watching' && fix && now() - fix.timestamp <= 300_000
      && fix.timestamp <= now() + 300_000 && (state.location === 'granted' || state.location === 'limited');
    if (!valid || !fix) {
      wanted = null;
      store.setState({ loading: false, stale: store.getState().area !== null });
      return;
    }
    const cell = areaCell(fix.latitude, fix.longitude);
    wanted = cell.key;
    const current = store.getState().area;
    if (current?.key === cell.key && now() - current.updatedAt < areaPolicy.freshMs) {
      if (store.getState().stale) store.setState({ stale: false });
      return;
    }
    if (current?.key === cell.key && !store.getState().stale) store.setState({ stale: true });
    if (current && current.key !== cell.key) store.setState({ area: null, stale: false });
    if (inFlight || (lastReadKey === cell.key && (!online || now() - lastLookupAt < areaPolicy.lookupIntervalMs))) return;
    const id = generation;
    inFlight = true;
    store.setState({ loading: true });
    void (async () => {
      try {
        if (lastReadKey !== cell.key) {
          lastReadKey = cell.key;
          const saved = await cache.read(cell.key).catch(() => null);
          if (id !== generation || wanted !== cell.key) return;
          if (saved) store.setState({ area: saved, loading: false, stale: now() - saved.updatedAt >= areaPolicy.freshMs });
          if (saved && now() - saved.updatedAt < areaPolicy.freshMs) return;
        }
        if (!online || now() - lastLookupAt < areaPolicy.lookupIntervalMs) return;
        lastLookupAt = now();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const address = await Promise.race([
          lookup(cell),
          new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), 5_000); }),
        ]).finally(() => clearTimeout(timeout));
        if (id !== generation) return;
        const label = areaLabel(address);
        if (!label) return;
        const value = { ...cell, label, updatedAt: now() };
        await cache.save(value).catch(() => undefined);
        if (id === generation && wanted === cell.key) store.setState({ area: value, stale: false });
      } catch { /* Keep the matching cached locality, or the coordinate fallback. */ }
      finally {
        if (id === generation) {
          inFlight = false;
          store.setState({ loading: false });
        }
      }
    })();
  };

  return {
    store,
    start() {
      if (unsubscribe) return;
      unsubscribe = location.subscribe(sync);
      sync(location.getState());
    },
    stop() {
      unsubscribe?.(); unsubscribe = undefined;
      generation++; inFlight = false; wanted = null; lastReadKey = null;
      store.setState({ loading: false, stale: store.getState().area !== null });
    },
    setOnline(value: boolean) { online = value; if (unsubscribe) sync(location.getState()); },
  };
}

export type AreaService = ReturnType<typeof createAreaService>;
