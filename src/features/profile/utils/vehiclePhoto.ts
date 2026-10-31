import { z } from 'zod';

const IMAGE_HOSTS = ['https://upload.wikimedia.org/', 'https://thumb.wikimedia.org/'];
// A make's page often leads with its badge, which is not a picture of the car.
const NOT_A_CAR = /logo|emblem|badge|\.svg/i;

export const vehiclePhotoResponseSchema = z.object({
  query: z.object({
    pages: z.array(z.object({
      title: z.string(),
      index: z.number().optional(),
      thumbnail: z.object({ source: z.string() }).optional(),
    })),
  }).optional(),
});

const words = (text: string) => text.trim().toLowerCase().split(/\s+/).filter(Boolean);

// A registration may say "CLIO 4 1.5 DCI", so a search for the make and first word follows the full one.
export function vehiclePhotoSearches(model: string) {
  const all = words(model);
  return [...new Set([all.join(' '), all.slice(0, 2).join(' ')])].filter(Boolean);
}

// The title must name the make and the model. No photo is better than another car.
export function pickVehiclePhoto(response: z.infer<typeof vehiclePhotoResponseSchema>, model: string) {
  const required = words(model).slice(0, 2);
  if (required.length < 2) return null;
  const pages = [...(response.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const match = pages.find(({ title, thumbnail }) => thumbnail
    && IMAGE_HOSTS.some((host) => thumbnail.source.startsWith(host)) && !NOT_A_CAR.test(thumbnail.source)
    && required.every((word) => words(title).includes(word)));
  return match?.thumbnail?.source ?? null;
}
