import { config } from '@/common/lib/config';

import type { CapturedPage, DocumentFields, DocumentType } from '../types/auth.schemas';
import { parseDocument, type OcrResult } from './documentParser';
import { getOcrModels, loadPageImage } from './ocrEngine';
import { readPage } from './paddle/pipeline';

const SAMPLE_FIELDS: Record<DocumentType, DocumentFields> = {
  driver_license: {
    category: 'B', nin: '109870123456789012', licenseNumber: 'A123456', lastName: 'Driver',
    firstName: 'Demo', dateOfBirth: '01.02.1990', placeOfBirth: 'Alger',
  },
  vehicle_registration: {
    genre: 'VP', brand: 'Renault', type: 'SYMBOL', serialNumber: 'VF1LB000000000000', bodyType: 'CI',
    energy: 'ES', power: '6', seats: '5', grossWeight: '1500', payload: '500',
    registrationNumber: '12345 123 16', previousNumber: '', firstRegistrationYear: '2023',
  },
};

const EMPTY: OcrResult = { fields: {}, lowConfidence: [] };

// Any failure leaves the review step empty for manual entry, so OCR never blocks onboarding.
export async function extractDocumentFields(type: DocumentType, pages: CapturedPage[]): Promise<OcrResult> {
  const images = pages.filter((page) => page.mimeType !== 'application/pdf');
  if (images.length === 0) return EMPTY;

  const models = await getOcrModels();
  // Expo Go and web have no runtime, so the mock keeps development moving there.
  if (!models) return config.useMockApi ? { fields: SAMPLE_FIELDS[type], lowConfidence: [] } : EMPTY;

  const read = [];
  for (const page of images) read.push(await readPage(await loadPageImage(page.uri, page.width ?? Infinity), models));
  return parseDocument(type, read);
}
