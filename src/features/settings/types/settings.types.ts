import { z } from 'zod';

export const settingsSchema = z.object({
  notifications: z.object({ crash_detected: z.boolean(), potential_accident: z.boolean(), accident_nearby: z.boolean() }),
  nearbyRadiusKm: z.number().min(1).max(50),
  crashDetection: z.boolean(),
  sensitivity: z.enum(['low', 'standard', 'high']),
  countdownSeconds: z.union([z.literal(60), z.literal(120), z.literal(180)]),
  voice: z.boolean(),
  voiceLanguage: z.enum(['app', 'en', 'fr', 'ar']),
  units: z.enum(['kmh', 'mph']),
  theme: z.enum(['system', 'light', 'dark']),
  dataSharing: z.boolean(),
  shareMedicalInfo: z.boolean(),
});
export type AppSettings = z.infer<typeof settingsSchema>;
export type SettingsPatch = Omit<Partial<AppSettings>, 'notifications'> & { notifications?: Partial<AppSettings['notifications']> };
export const defaultSettings: AppSettings = {
  notifications: { crash_detected: true, potential_accident: true, accident_nearby: true },
  nearbyRadiusKm: 5, crashDetection: true, sensitivity: 'standard', countdownSeconds: 180,
  voice: false, voiceLanguage: 'app', units: 'kmh', theme: 'system', dataSharing: false, shareMedicalInfo: false,
};
