import { z } from 'zod';

export const onboardingStatusSchema = z.enum(['documents_required', 'complete']);
export const documentTypeSchema = z.enum(['driver_license', 'vehicle_registration']);
export const documentSourceSchema = z.enum(['scan', 'upload']);
export const documentStatusSchema = z.enum(['missing', 'pending', 'verified', 'rejected']);

export const nameField = z.string().trim().min(2).max(50);
export const emailField = z.string().trim().toLowerCase().pipe(z.email());
export const mobileNumberField = z.string().trim().regex(/^\+[1-9]\d{7,14}$/);

export const userSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  mobileNumber: z.string(),
  onboardingStatus: onboardingStatusSchema,
});

// Password rules live with the registration form in #23. The API only needs
// the validated value, and `confirmPassword` is never sent.
export const registerRequestSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: emailField,
  mobileNumber: mobileNumberField,
  password: z.string().min(1),
});

export const loginRequestSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export const documentSchema = z.object({
  type: documentTypeSchema,
  status: documentStatusSchema,
  rejectionReason: z.string().nullable(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const documentsResponseSchema = z.object({
  documents: z.array(documentSchema),
  onboardingStatus: onboardingStatusSchema,
});

export const documentUploadSchema = z.object({
  type: documentTypeSchema,
  source: documentSourceSchema,
  uri: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  // Keys and capture language are finalized with OCR in #28.
  captureLanguage: z.enum(['fr', 'ar']),
  fields: z.record(z.string(), z.string()),
});

export type User = z.infer<typeof userSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;
export type DocumentsResponse = z.infer<typeof documentsResponseSchema>;
export type DocumentUpload = z.infer<typeof documentUploadSchema>;
