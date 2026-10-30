import type { RgbaImage } from './paddle/image';
import type { OcrModels } from './paddle/pipeline';

// Web previews have no ONNX Runtime, so the review step falls back as usual.
export async function getOcrModels(): Promise<OcrModels> {
  throw new Error('OCR is not available on web.');
}

export async function loadPageImage(): Promise<RgbaImage> {
  throw new Error('OCR is not available on web.');
}
