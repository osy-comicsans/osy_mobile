import { z } from 'zod';

import { LANGUAGES } from '@/common/lib/i18n/languages';

import { mobileNumberField, nameField, userSchema } from '@/features/auth/types/auth.schemas';

export const profileSchema = userSchema;

export const profileUpdateSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  mobileNumber: mobileNumberField,
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
