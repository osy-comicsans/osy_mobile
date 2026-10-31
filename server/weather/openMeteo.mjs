import { normalizeWeather, openMeteoForecastUrl, openMeteoParams } from '../../src/features/weather/utils/openMeteo.ts';

export { normalizeWeather };

export function createOpenMeteoProvider({ apiKey = '', fetchImpl = fetch, now = Date.now } = {}) {
  return async (area) => {
    const url = new URL(apiKey ? 'https://customer-api.open-meteo.com/v1/forecast' : openMeteoForecastUrl);
    url.search = new URLSearchParams({ ...openMeteoParams(area), ...(apiKey ? { apikey: apiKey } : {}) }).toString();
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) throw new Error('Weather provider is unavailable.');
    // Reject an unexpected large response before parsing; credentials and raw
    // upstream errors are never included in HTTP responses or logs.
    const body = await response.text();
    if (body.length > 256_000) throw new Error('Weather response is too large.');
    return normalizeWeather(JSON.parse(body), area, now());
  };
}
