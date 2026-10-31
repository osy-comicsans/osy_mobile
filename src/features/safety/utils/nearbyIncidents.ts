import { createStore } from 'zustand/vanilla';

import type { LocationFix } from '@/features/location/types/location.types';
import { distanceMeters as distanceBetween } from '@/features/location/utils/location.utils';

import type { Incident, NearbyIncidentsQuery } from '../types/safety.schemas';

export interface NearbyPreferences {
  enabled: boolean;
  radiusKm: number;
}

export interface NearbyIncident extends Incident {
  distanceMeters: number;
}

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface NearbyOptions {
  fetchNearby(query: NearbyIncidentsQuery): Promise<{ incidents: Incident[] }>;
  preferences(): NearbyPreferences;
  storage: KeyValueStorage;
  now?: () => number;
}

type Remembered = Record<string, number>;

const STORAGE_KEY = 'osy.nearby.incidents';
// Checks again after a minute, or sooner once the driver has moved this far.
const RECHECK_MS = 60_000;
const RECHECK_METERS = 500;
// Help is needed in the first hours. An older report is history, not a call to help.
const MAX_AGE_MS = 2 * 60 * 60_000;
// Longer than MAX_AGE_MS, so a remembered incident is never alerted twice.
const REMEMBER_MS = 24 * 60 * 60_000;

// Watches for accidents near the user so they can help, and never alerts about
// the user's own report or crash. The backend's push covers a closed app.
export function createNearbyIncidents({ fetchNearby, preferences, storage, now = Date.now }: NearbyOptions) {
  const store = createStore<{ incidents: NearbyIncident[] }>(() => ({ incidents: [] }));
  let own: Remembered = {};
  let alerted: Remembered = {};
  let loading: Promise<void> | null = null;
  let checked: { at: number; latitude: number; longitude: number } | null = null;
  let checking = false;

  const recent = (entries: Remembered) => Object.fromEntries(
    Object.entries(entries).filter(([, at]) => now() - at < REMEMBER_MS),
  );

  // Unreadable saved data starts the record empty.
  const load = () => (loading ??= storage.getItem(STORAGE_KEY)
    .then((saved) => {
      const parsed = saved ? (JSON.parse(saved) as { own?: Remembered; alerted?: Remembered }) : {};
      own = recent(parsed.own ?? {});
      alerted = recent(parsed.alerted ?? {});
    })
    .catch(() => undefined));

  // Losing the record only risks one repeated alert, so a failed write is not retried.
  const save = () => storage
    .setItem(STORAGE_KEY, JSON.stringify({ own: recent(own), alerted: recent(alerted) }))
    .catch(() => undefined);

  const relevant = (incidents: Incident[], fix: LocationFix, radiusKm: number): NearbyIncident[] => incidents
    .filter(({ id, occurredAt }) => !own[id] && now() - Date.parse(occurredAt) <= MAX_AGE_MS)
    .map((incident) => ({ ...incident, distanceMeters: distanceBetween(fix, incident.location) }))
    .filter(({ distanceMeters }) => distanceMeters <= radiusKm * 1000)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const check = async (fix: LocationFix, radiusKm: number) => {
    await load();
    const { incidents } = await fetchNearby({ latitude: fix.latitude, longitude: fix.longitude, radiusKm });
    checked = { at: now(), latitude: fix.latitude, longitude: fix.longitude };
    const nearby = relevant(incidents, fix, radiusKm);
    store.setState({ incidents: nearby });
    return nearby;
  };

  // Returns the incident to alert about, if any.
  const update = async (fix: LocationFix, busy: boolean): Promise<NearbyIncident | null> => {
    const { enabled, radiusKm } = preferences();
    if (!enabled) {
      store.setState({ incidents: [] });
      return null;
    }
    if (checking) return null;
    if (checked && now() - checked.at < RECHECK_MS && distanceBetween(checked, fix) < RECHECK_METERS) return null;
    checking = true;
    try {
      const nearby = await check(fix, radiusKm);
      // The driver's own check-in comes first. The alert waits for a later check.
      if (busy) return null;
      const fresh = nearby.find(({ id }) => !alerted[id]);
      if (!fresh) return null;
      alerted = { ...alerted, [fresh.id]: now() };
      void save();
      return fresh;
    } catch {
      // A failed check is tried again with the next location update.
      return null;
    } finally {
      checking = false;
    }
  };

  // Checks at once without alerting, for an alert opened from a push before any check ran.
  const refresh = async (fix: LocationFix) => {
    const { enabled, radiusKm } = preferences();
    if (!enabled || checking) return;
    checking = true;
    try {
      await check(fix, radiusKm);
    } catch {
      // The alert screen still shows what the alert itself carried.
    } finally {
      checking = false;
    }
  };

  const markOwn = async (id: string) => {
    await load();
    own = { ...own, [id]: now() };
    store.setState(({ incidents }) => ({ incidents: incidents.filter((incident) => incident.id !== id) }));
    await save();
  };

  const find = (id: string) => store.getState().incidents.find((incident) => incident.id === id) ?? null;

  return { store, update, refresh, markOwn, find };
}

export type NearbyIncidents = ReturnType<typeof createNearbyIncidents>;
