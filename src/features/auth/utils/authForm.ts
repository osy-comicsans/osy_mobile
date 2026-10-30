import { ApiError } from '@/common/lib/api/apiError';

import type { DocumentRecord, DocumentType, DocumentFields } from '../types/auth.schemas';
import { DOCUMENT_FIELDS, OPTIONAL_DOCUMENT_FIELDS, DOCUMENT_ORDER } from '../types/auth.schemas';

interface SafeParser {
  safeParse(values: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };
}

// Returns the first error for each field, as a translation key.
export function fieldErrors(schema: SafeParser, values: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { path, message } of schema.safeParse(values).error?.issues ?? []) {
    const field = String(path[0]);
    errors[field] ??= message;
  }
  return errors;
}

export interface MappedError {
  fieldKeys: Record<string, string>;
  fieldText: Record<string, string>;
  formKey: string | null;
}

const takenKeys: Record<string, string> = {
  email: 'auth.errors.emailTaken',
  mobileNumber: 'auth.errors.mobileTaken',
};

export function mapRegisterError(error: unknown): MappedError {
  if (error instanceof ApiError && error.kind === 'conflict') {
    const fieldKeys = Object.fromEntries(
      Object.keys(error.fields).filter((field) => takenKeys[field]).map((field) => [field, takenKeys[field]]),
    );
    if (Object.keys(fieldKeys).length > 0) return { fieldKeys, fieldText: {}, formKey: null };
  }
  if (error instanceof ApiError && error.kind === 'validation' && Object.keys(error.fields).length > 0) {
    return { fieldKeys: {}, fieldText: error.fields, formKey: null };
  }
  return { fieldKeys: {}, fieldText: {}, formKey: formErrorKey(error) };
}

export function formErrorKey(error: unknown): string {
  return `errors.api.${error instanceof ApiError ? error.kind : 'request'}`;
}

// One message for any wrong login, so the form never reveals which accounts exist.
export function loginErrorKey(error: unknown): string {
  return error instanceof ApiError && error.kind === 'unauthorized'
    ? 'auth.errors.invalidCredentials'
    : formErrorKey(error);
}

export function nextDocument(documents: DocumentRecord[]): DocumentType | null {
  const isDone = (type: DocumentType) => {
    const status = documents.find((document) => document.type === type)?.status;
    return status === 'pending' || status === 'verified';
  };
  return DOCUMENT_ORDER.find((type) => !isDone(type)) ?? null;
}

export function missingFields(type: DocumentType, fields: DocumentFields): string[] {
  return DOCUMENT_FIELDS[type].filter((field) => (
    !OPTIONAL_DOCUMENT_FIELDS.includes(field) && !fields[field]?.trim()
  ));
}
