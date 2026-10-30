import { z } from 'zod';

const timestamp = z.iso.datetime({ offset: true });
const measurement = z.number().finite().nullable();
const nonnegative = z.number().finite().nonnegative().nullable();

export const weatherConditionSchema = z.enum([
  'clear', 'partly_cloudy', 'cloudy', 'fog', 'drizzle', 'rain',
  'freezing_precipitation', 'snow', 'thunderstorm', 'unknown',
]);

export const weatherReadingSchema = z.object({
  validAt: timestamp,
  condition: weatherConditionSchema,
  temperatureC: measurement,
  humidityPercent: z.number().min(0).max(100).nullable(),
  precipitationMm: nonnegative,
  precipitationIntervalSeconds: z.number().int().positive(),
  visibilityM: nonnegative,
  windSpeedMs: nonnegative,
  windGustMs: nonnegative,
  windDirectionDegrees: z.number().min(0).max(360).nullable(),
});

export const weatherSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  provider: z.literal('open-meteo'),
  dataKind: z.literal('model'),
  area: z.object({
    id: z.string().regex(/^grid-v1:\d+:\d+$/),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  fetchedAt: timestamp,
  freshUntil: timestamp,
  current: weatherReadingSchema,
  hourly: z.array(weatherReadingSchema).max(48),
  sun: z.object({
    timezone: z.string().min(1).max(64).refine((value) => {
      try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
      catch { return false; }
    }, 'Invalid weather timezone.'),
    sunriseAt: timestamp.nullable(),
    sunsetAt: timestamp.nullable(),
  }),
}).refine((value) => Date.parse(value.freshUntil) >= Date.parse(value.fetchedAt), {
  message: 'Weather expiry must follow retrieval time.',
});

export type WeatherCondition = z.infer<typeof weatherConditionSchema>;
export type WeatherReading = z.infer<typeof weatherReadingSchema>;
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;
export type WeatherArea = WeatherSnapshot['area'];
export type WeatherFreshness = 'fresh' | 'stale' | 'expired';
export type IcingRisk = 'possible' | 'unknown';

export interface WeatherRiskInputs {
  available: boolean;
  validAt: string;
  temperatureC: number | null;
  precipitationMmPerHour: number | null;
  visibilityM: number | null;
  windSpeedMs: number | null;
  windGustMs: number | null;
  isDay: boolean | null;
  icingRisk: IcingRisk;
  icingMethod: 'weather-heuristic-v1';
}
