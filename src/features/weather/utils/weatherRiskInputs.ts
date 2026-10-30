import type { WeatherRiskInputs, WeatherSnapshot } from '../types/weather.types';
import { weatherFreshness } from './weatherPolicy';

// These are weather inputs, not an accident probability or a road-surface
// measurement. "unknown" deliberately never promises that a road is ice-free.
export function toWeatherRiskInputs(
  snapshot: WeatherSnapshot, matchingArea: boolean, now = Date.now(),
): WeatherRiskInputs {
  const reading = snapshot.current;
  const available = matchingArea && weatherFreshness(snapshot, now) === 'fresh';
  const hasWetEvidence = reading.precipitationMm !== null && reading.precipitationMm > 0;
  const freezing = reading.condition === 'freezing_precipitation';
  const possible = freezing || (reading.temperatureC !== null && reading.temperatureC <= 3
    && (hasWetEvidence || reading.condition === 'snow' || (reading.humidityPercent ?? 0) >= 90));
  const sunrise = snapshot.sun.sunriseAt === null ? NaN : Date.parse(snapshot.sun.sunriseAt);
  const sunset = snapshot.sun.sunsetAt === null ? NaN : Date.parse(snapshot.sun.sunsetAt);
  const sunDateMatches = new Intl.DateTimeFormat('en-CA', { timeZone: snapshot.sun.timezone }).format(now)
    === new Intl.DateTimeFormat('en-CA', { timeZone: snapshot.sun.timezone }).format(Date.parse(snapshot.fetchedAt));
  return {
    available, validAt: reading.validAt,
    temperatureC: available ? reading.temperatureC : null,
    // Interval-average intensity, not an observed total over the last hour.
    precipitationMmPerHour: available && reading.precipitationMm !== null
      ? reading.precipitationMm * 3600 / reading.precipitationIntervalSeconds : null,
    visibilityM: available ? reading.visibilityM : null,
    windSpeedMs: available ? reading.windSpeedMs : null,
    windGustMs: available ? reading.windGustMs : null,
    isDay: available && sunDateMatches && Number.isFinite(sunrise) && Number.isFinite(sunset)
      ? now >= sunrise && now < sunset : null,
    icingRisk: available && possible ? 'possible' : 'unknown',
    icingMethod: 'weather-heuristic-v1',
  };
}
