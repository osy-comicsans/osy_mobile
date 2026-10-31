import { z } from 'zod';

export const areaSnapshotSchema = z.object({
  key: z.string().regex(/^area-v1:\d+:\d+$/),
  label: z.string().trim().min(1).max(160),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  updatedAt: z.number().int().nonnegative(),
});

export type AreaSnapshot = z.infer<typeof areaSnapshotSchema>;
export interface AreaState { area: AreaSnapshot | null; loading: boolean; stale: boolean }
export interface GeocodedArea { district: string | null; city: string | null; region: string | null }

export interface AreaCache {
  read(key: string): Promise<AreaSnapshot | null>;
  save(area: AreaSnapshot): Promise<void>;
}
