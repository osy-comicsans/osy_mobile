import type { CapturedPage, DocumentType } from '../types/auth.schemas';
import { parseDocument, type OcrResult } from './documentParser';
import { getOcrModels, loadPageImage } from './ocrEngine';
import { readPage } from './paddle/pipeline';

export interface OcrOutcome extends OcrResult {
  // True when OCR could not run, so the review step says so instead of looking empty.
  failed: boolean;
  failureReason?: string;
}

const EMPTY: OcrResult = { fields: {}, lowConfidence: [] };

// Any failure leaves the review step empty for manual entry, so OCR never blocks onboarding.
export async function extractDocumentFields(type: DocumentType, pages: CapturedPage[]): Promise<OcrOutcome> {
  const images = pages.filter((page) => page.mimeType !== 'application/pdf');
  if (images.length === 0) return { ...EMPTY, failed: false };

  try {
    const models = await getOcrModels();
    const read = [];
    for (const page of images) read.push(await readPage(await loadPageImage(page.uri, page.width ?? Infinity), models));
    return { ...parseDocument(type, read), failed: false };
  } catch (error) {
    return { ...EMPTY, failed: true, failureReason: error instanceof Error ? error.message : String(error) };
  }
}
