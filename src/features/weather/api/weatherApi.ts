import type { AxiosInstance } from 'axios';
import { ApiError, parseResponse } from '@/common/lib/api/apiError';

import { weatherSnapshotSchema, type WeatherArea } from '../types/weather.types';
import { normalizeWeather, openMeteoForecastUrl, openMeteoParams } from '../utils/openMeteo';
import { weatherPolicy } from '../utils/weatherPolicy';

export function createWeatherApi(client: Pick<AxiosInstance, 'get'>, baseUrl: () => string) {
  return async function getWeather(area: WeatherArea, signal?: AbortSignal) {
    const base = baseUrl().replace(/\/+$/, '');
    const value = await parseResponse(client.get(`${base}/weather`, {
      params: { latitude: area.latitude, longitude: area.longitude },
      timeout: weatherPolicy.requestTimeoutMs, signal,
      // Weather always comes from the service, including when account screens
      // use the development mock adapter. No synthetic weather reaches Home.
      adapter: 'fetch',
    }), weatherSnapshotSchema);
    if (value.area.id !== area.id) throw new ApiError('invalid_response', 'Weather area does not match.');
    return value;
  };
}

// Used when no weather service is configured. Open-Meteo's public endpoint needs no key.
export function createOpenMeteoApi(client: Pick<AxiosInstance, 'get'>) {
  return async function getWeather(area: WeatherArea, signal?: AbortSignal) {
    const { data } = await client.get(openMeteoForecastUrl, {
      params: openMeteoParams(area), timeout: weatherPolicy.requestTimeoutMs, signal, adapter: 'fetch',
    });
    return normalizeWeather(data, area);
  };
}
