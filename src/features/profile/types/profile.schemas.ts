import { z } from 'zod';

import { LANGUAGES } from '@/common/lib/i18n/languages';

import { mobileNumberField, nameField, userSchema } from '@/features/auth/types/auth.schemas';

const medicalSchema = z.object({ bloodType: z.string().trim().max(10), allergies: z.string().trim().max(500), conditions: z.string().trim().max(1000) });
export const profileSchema = userSchema.extend({
  photoUrl: z.url().nullable().default(null),
  vehicle: z.string().max(150).nullable().default(null),
  medical: medicalSchema.default({ bloodType: '', allergies: '', conditions: '' }),
});

export const profileUpdateSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  mobileNumber: mobileNumberField,
  vehicle: z.string().trim().max(150).nullable().optional(),
  medical: medicalSchema.optional(),
});

export const emergencyContactSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  mobileNumber: mobileNumberField,
  relationship: z.string().trim().max(50).nullable(),
});

export const emergencyContactsSchema = z.object({ contacts: z.array(emergencyContactSchema) });

export const pushTokenRequestSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  language: z.enum(LANGUAGES),
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;
export type PushTokenRequest = z.infer<typeof pushTokenRequestSchema>;

export const drivingStatsSchema = z.object({ trips: z.number().int().nonnegative(), distanceMeters: z.number().nonnegative(), warnings: z.number().int().nonnegative() });
export const reportHistorySchema = z.object({ reports: z.array(z.object({
  id: z.string(), occurredAt: z.iso.datetime({ offset: true }), type: z.string(), severity: z.string(),
  status: z.enum(['received', 'reviewing', 'resolved']),
})).max(100) });
export const profileBundleSchema = z.object({ profile: profileSchema, contacts: z.array(emergencyContactSchema), stats: drivingStatsSchema.nullable(), reports: reportHistorySchema.shape.reports,
  pendingPhoto: z.string().regex(/^[a-f0-9]{64}\/[a-f0-9-]+\.jpg$/i).nullable().default(null), historyAvailable: z.boolean().default(false) });
export type ProfileBundle = z.infer<typeof profileBundleSchema>;
