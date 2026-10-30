import { weatherArea, weatherPolicy } from '../../src/features/weather/utils/weatherPolicy.ts';

export function createWeatherService({ provider, now = Date.now, dailyBudget = 1000, maxEntries = 1000 }) {
  const cache = new Map();
  const inFlight = new Map();
  let day = -1;
  let used = 0;
  let minute = -1;
  let minuteUsed = 0;
  let backoffUntil = 0;

  return {
    async get(latitude, longitude) {
      const area = weatherArea(latitude, longitude);
      const time = now();
      const bucket = Math.floor(time / weatherPolicy.refreshMs);
      const cached = cache.get(area.id);
      const fallback = cached && time - Date.parse(cached.snapshot.fetchedAt) <= weatherPolicy.retentionMs
        ? cached.snapshot : null;
      if (fallback && cached.bucket === bucket && time < Date.parse(fallback.freshUntil)) return fallback;
      if (inFlight.has(area.id)) return inFlight.get(area.id);

      if (Math.floor(time / 86_400_000) !== day) { day = Math.floor(time / 86_400_000); used = 0; }
      if (Math.floor(time / 60_000) !== minute) { minute = Math.floor(time / 60_000); minuteUsed = 0; }
      if (used >= dailyBudget || minuteUsed >= 60 || inFlight.size >= 5 || time < backoffUntil) {
        if (fallback) return fallback;
        throw new Error('Weather is temporarily unavailable.');
      }
      used++; minuteUsed++;
      const request = Promise.resolve().then(() => provider(area)).then((snapshot) => {
        cache.delete(area.id);
        cache.set(area.id, { bucket: Math.floor(Date.parse(snapshot.fetchedAt) / weatherPolicy.refreshMs), snapshot });
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        return snapshot;
      }).catch(() => {
        backoffUntil = now() + 60_000;
        if (fallback) return fallback;
        throw new Error('Weather is temporarily unavailable.');
      }).finally(() => inFlight.delete(area.id));
      inFlight.set(area.id, request);
      return request;
    },
  };
}
