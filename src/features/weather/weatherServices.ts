import { create } from 'axios';

import { publicApi } from '@/common/lib/api/axios';
import { config } from '@/common/lib/config';

import { createOpenMeteoApi, createWeatherApi } from './api/weatherApi';

const serviceUrl = config.weatherApiUrl || config.apiUrl;

// A separate client, so a provider request carries nothing from the app's API setup.
export const getWeather = serviceUrl
  ? createWeatherApi(publicApi, () => serviceUrl)
  : createOpenMeteoApi(create());
