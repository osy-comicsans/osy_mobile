import { createOpenMeteoProvider } from './openMeteo.mjs';
import { createWeatherService } from './weatherService.mjs';
import { createWeatherServer } from './http.mjs';

const apiKey = process.env.WEATHER_API_KEY?.trim() ?? '';
if (process.env.NODE_ENV === 'production' && !apiKey) {
  throw new Error('Set WEATHER_API_KEY for the commercial Open-Meteo endpoint in production.');
}
const budget = Number(process.env.WEATHER_DAILY_REQUEST_BUDGET ?? '1000');
const port = Number(process.env.WEATHER_PORT ?? '8787');
if (!Number.isInteger(budget) || budget < 1 || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid weather service port or request budget.');
}
const server = createWeatherServer({
  service: createWeatherService({ provider: createOpenMeteoProvider({ apiKey }), dailyBudget: budget }),
  allowedOrigins: (process.env.WEATHER_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
});
server.requestTimeout = 10_000;
server.headersTimeout = 10_000;
server.listen(port, process.env.WEATHER_HOST ?? '127.0.0.1', () => {
  console.info(`OSY weather service listening on port ${port}.`);
});
