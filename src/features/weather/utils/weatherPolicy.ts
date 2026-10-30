import type { WeatherArea, WeatherFreshness, WeatherSnapshot } from '../types/weather.types';

export const weatherPolicy = {
  refreshMs: 15 * 60_000,
  maxRiskAgeMs: 60 * 60_000,
  retentionMs: 48 * 60 * 60_000,
  locationMaxAgeMs: 5 * 60_000,
  requestTimeoutMs: 8_000,
  maxAreas: 40,
} as const;

// Fixed, versioned ~5.6 km latitude cells. Sharing keys and using their centres
// makes server/device cache hits independent of GPS jitter and user identity.
export function weatherArea(latitude: number, longitude: number): WeatherArea {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('Invalid weather coordinates.');
  const lat = Math.min(3599, Math.floor((latitude + 90) * 20));
  const lon = Math.min(7199, Math.floor(((longitude === 180 ? -180 : longitude) + 180) * 20));
  return {
    id: `grid-v1:${lat}:${lon}`,
    latitude: Number((lat / 20 - 90 + 0.025).toFixed(6)),
    longitude: Number((lon / 20 - 180 + 0.025).toFixed(6)),
  };
}

export function weatherFreshness(snapshot: WeatherSnapshot, now = Date.now()): WeatherFreshness {
  const age = now - Date.parse(snapshot.current.validAt);
  // A clock skew or old provider/model timestamp cannot be made fresh by
  // fetching again. Expired values remain displayable as last-known only.
  if (age < -5 * 60_000 || age > weatherPolicy.maxRiskAgeMs) return 'expired';
  return now >= Date.parse(snapshot.freshUntil) ? 'stale' : 'fresh';
}

export function nextWeatherHours(snapshot: WeatherSnapshot, now = Date.now()) {
  return snapshot.hourly.filter((hour) => Date.parse(hour.validAt) > now).slice(0, 6);
}
