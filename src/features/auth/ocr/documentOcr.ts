import { config } from '@/common/lib/config';

import type { CapturedPage, DocumentFields, DocumentType } from '../types/auth.schemas';

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

// The on-device OCR from #28 replaces this. Until then, only the mock returns
// values. Everywhere else the review step starts empty for manual entry.
export async function extractDocumentFields(type: DocumentType, pages: CapturedPage[]): Promise<DocumentFields> {
  const readable = pages.some((page) => page.mimeType !== 'application/pdf');
  return config.useMockApi && readable ? SAMPLE_FIELDS[type] : {};
}
