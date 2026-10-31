import { z } from 'zod';

import { weatherSnapshotSchema, type WeatherArea } from '../types/weather.types.ts';
import { weatherPolicy } from './weatherPolicy.ts';

// Shared with server/weather, which is why these imports name their extension.
export const openMeteoForecastUrl = 'https://api.open-meteo.com/v1/forecast';

const variables = 'temperature_2m,relative_humidity_2m,precipitation,visibility,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code';

export const openMeteoParams = (area: WeatherArea) => ({
  latitude: String(area.latitude), longitude: String(area.longitude),
  current: variables, hourly: variables, daily: 'sunrise,sunset',
  forecast_days: '2', forecast_hours: '8', timezone: 'auto', timeformat: 'unixtime',
  wind_speed_unit: 'ms', temperature_unit: 'celsius', precipitation_unit: 'mm',
});

const values = z.array(z.number().finite().nullable());
const series = z.object({
  time: z.array(z.number().int()), temperature_2m: values, relative_humidity_2m: values,
  precipitation: values, visibility: values, wind_speed_10m: values,
  wind_gusts_10m: values, wind_direction_10m: values, weather_code: values,
});
const rawSchema = z.object({
  timezone: z.string().max(64),
  current: z.object({
    time: z.number().int(), interval: z.number().int().positive(),
    temperature_2m: z.number().nullable(), relative_humidity_2m: z.number().nullable(),
    precipitation: z.number().nullable(), visibility: z.number().nullable(),
    wind_speed_10m: z.number().nullable(), wind_gusts_10m: z.number().nullable(),
    wind_direction_10m: z.number().nullable(), weather_code: z.number().nullable(),
  }),
  hourly: series,
  daily: z.object({ time: z.array(z.number()), sunrise: values, sunset: values }),
});

function condition(code: number | null) {
  if (code === null) return 'unknown';
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([51, 53, 55].includes(code)) return 'drizzle';
  if ([56, 57, 66, 67].includes(code)) return 'freezing_precipitation';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 97, 99].includes(code)) return 'thunderstorm';
  return 'unknown';
}
const iso = (seconds: number | null | undefined) => seconds == null ? null : new Date(seconds * 1000).toISOString();
const nonnegative = (value: number | null) => value == null || value < 0 ? null : value;

type RawReading = z.infer<typeof rawSchema>['current'];

function reading(value: Omit<RawReading, 'interval'>, interval: number) {
  const validAt = iso(value.time) as string;
  return {
    validAt,
    condition: condition(value.weather_code),
    temperatureC: value.temperature_2m,
    humidityPercent: value.relative_humidity_2m,
    precipitationMm: nonnegative(value.precipitation), precipitationIntervalSeconds: interval,
    visibilityM: nonnegative(value.visibility), windSpeedMs: nonnegative(value.wind_speed_10m),
    windGustMs: nonnegative(value.wind_gusts_10m), windDirectionDegrees: value.wind_direction_10m,
  };
}

export function normalizeWeather(input: unknown, area: WeatherArea, now = Date.now()) {
  const raw = rawSchema.parse(input);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: raw.timezone });
  const day = raw.daily.time.findIndex((time) => date.format(time * 1000) === date.format(now));
  if (day < 0 || raw.current.time * 1000 > now + 300_000) throw new Error('Weather time is invalid.');
  for (const [key, value] of Object.entries(raw.hourly)) {
    if (key !== 'time' && value.length !== raw.hourly.time.length) throw new Error('Incomplete weather series.');
  }
  if (raw.current.temperature_2m === null && raw.current.visibility === null
    && raw.current.precipitation === null) throw new Error('Weather measurements are unavailable.');
  const { hourly: data } = raw;
  const hourly = data.time.map((time, index) => reading({
    time,
    temperature_2m: data.temperature_2m[index],
    relative_humidity_2m: data.relative_humidity_2m[index],
    precipitation: data.precipitation[index],
    visibility: data.visibility[index],
    wind_speed_10m: data.wind_speed_10m[index],
    wind_gusts_10m: data.wind_gusts_10m[index],
    wind_direction_10m: data.wind_direction_10m[index],
    weather_code: data.weather_code[index],
  }, 3600)).filter((point) => Date.parse(point.validAt) > now).slice(0, 6);
  const bucketEnd = (Math.floor(now / weatherPolicy.refreshMs) + 1) * weatherPolicy.refreshMs;
  return weatherSnapshotSchema.parse({
    schemaVersion: 1, provider: 'open-meteo', dataKind: 'model', area,
    fetchedAt: new Date(now).toISOString(),
    freshUntil: new Date(Math.max(now, Math.min(bucketEnd, raw.current.time * 1000 + weatherPolicy.maxRiskAgeMs))).toISOString(),
    current: reading(raw.current, raw.current.interval), hourly,
    sun: { timezone: raw.timezone, sunriseAt: iso(raw.daily.sunrise[day]), sunsetAt: iso(raw.daily.sunset[day]) },
  });
}
