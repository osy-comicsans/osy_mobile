import { publicApi } from '@/common/lib/api/axios';
import { config } from '@/common/lib/config';

import { createWeatherApi } from './api/weatherApi';

export const weatherConfigured = Boolean(config.weatherApiUrl || config.apiUrl);
export const getWeather = createWeatherApi(publicApi, () => config.weatherApiUrl || config.apiUrl);
