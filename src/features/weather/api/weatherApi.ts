import type { AxiosInstance } from 'axios';
import { ApiError, parseResponse } from '@/common/lib/api/apiError';

import { weatherSnapshotSchema, type WeatherArea } from '../types/weather.types';
import { weatherPolicy } from '../utils/weatherPolicy';

export function createWeatherApi(client: Pick<AxiosInstance, 'get'>, baseUrl: () => string) {
  return async function getWeather(area: WeatherArea, signal?: AbortSignal) {
    const base = baseUrl().replace(/\/+$/, '');
    if (!base) throw new ApiError('request', 'Weather service is not configured.');
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
