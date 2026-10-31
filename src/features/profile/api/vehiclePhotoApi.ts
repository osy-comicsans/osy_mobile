import type { AxiosInstance } from 'axios';

import { pickVehiclePhoto, vehiclePhotoResponseSchema, vehiclePhotoSearches } from '../utils/vehiclePhoto';

const SEARCH_URL = 'https://en.wikipedia.org/w/api.php';

// Only the make and model leave the phone, never the plate or serial number.
export function createVehiclePhotoApi(client: Pick<AxiosInstance, 'get'>) {
  return async function findVehiclePhoto(model: string, signal?: AbortSignal) {
    for (const search of vehiclePhotoSearches(model)) {
      const { data } = await client.get(SEARCH_URL, {
        params: {
          action: 'query', generator: 'search', gsrsearch: search, gsrlimit: 5, prop: 'pageimages',
          piprop: 'thumbnail', pithumbsize: 900, format: 'json', formatversion: 2, origin: '*',
        },
        timeout: 8_000, signal, adapter: 'fetch',
      });
      const photo = pickVehiclePhoto(vehiclePhotoResponseSchema.parse(data), model);
      if (photo) return photo;
    }
    return null;
  };
}
