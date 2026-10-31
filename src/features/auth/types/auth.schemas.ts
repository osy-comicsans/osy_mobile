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

const mimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'application/pdf']);

export const capturedPageSchema = z.object({
  side: z.enum(['front', 'back']),
  uri: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: mimeTypeSchema,
  width: z.number().optional(),
});

export const documentUploadSchema = z.object({
  type: documentTypeSchema,
  source: documentSourceSchema,
  pages: z.array(capturedPageSchema).length(2),
  // Keys and capture language are finalized with OCR in #28.
  captureLanguage: z.enum(['fr', 'ar']),
  fields: z.record(z.string(), z.string()),
  consentVersion: z.string().min(1),
  consentedAt: z.iso.datetime({ offset: true }),
});

// Form schemas carry translation keys as their messages. The limits are the
// starting proposal from #23, not agreed rules.
const formName = z.string().trim().min(2, 'auth.errors.nameShort').max(50, 'auth.errors.nameLong');
const formEmail = z.string().trim().toLowerCase().pipe(z.email('auth.errors.emailInvalid'));

export const registerFormSchema = z.object({
  firstName: formName,
  lastName: formName,
  email: formEmail,
  // The form only takes Algerian numbers: +213 and the 9 national digits.
  mobileNumber: z.string().trim().regex(/^\+213\d{9}$/, 'auth.errors.mobileInvalid'),
  password: z.string()
    .min(8, 'auth.errors.passwordShort')
    .max(72, 'auth.errors.passwordLong')
    .regex(/[a-z]/, 'auth.errors.passwordLowercase')
    .regex(/[A-Z]/, 'auth.errors.passwordUppercase')
    .regex(/[0-9]/, 'auth.errors.passwordNumber'),
});

export const loginFormSchema = z.object({
  email: formEmail,
  password: z.string().min(1, 'auth.errors.passwordRequired'),
});

export const documentFileSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf'], 'documents.errors.fileType'),
  sizeBytes: z.number().max(10 * 1024 * 1024, 'documents.errors.fileSize'),
});

// Stable keys from #28. Labels come from translations.
export const DOCUMENT_FIELDS = {
  driver_license: ['category', 'nin', 'licenseNumber', 'lastName', 'firstName', 'dateOfBirth', 'placeOfBirth'],
  vehicle_registration: [
    'genre', 'brand', 'type', 'serialNumber', 'bodyType', 'energy', 'power', 'seats',
    'grossWeight', 'payload', 'registrationNumber', 'previousNumber', 'firstRegistrationYear',
  ],
} as const;

export const OPTIONAL_DOCUMENT_FIELDS: readonly string[] = ['previousNumber'];
export const DOCUMENT_ORDER = ['driver_license', 'vehicle_registration'] as const;
export const CONSENT_VERSION = 'draft-2026-10';

export type User = z.infer<typeof userSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;
export type DocumentsResponse = z.infer<typeof documentsResponseSchema>;
export type DocumentUpload = z.infer<typeof documentUploadSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentSource = z.infer<typeof documentSourceSchema>;
export type CapturedPage = z.infer<typeof capturedPageSchema>;
export type DocumentFieldKey = (typeof DOCUMENT_FIELDS)[DocumentType][number];
export type DocumentFields = Partial<Record<DocumentFieldKey, string>>;
