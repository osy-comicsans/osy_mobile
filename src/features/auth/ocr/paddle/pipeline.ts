import { findTextBoxes, prepareDetection } from './detection';
import { cropImage, type RgbaImage } from './image';
import { ctcDecode, prepareRecognition, toReadingOrder } from './recognition';

export type Script = 'latin' | 'arabic';

export interface OcrTensor {
  data: ArrayLike<number>;
  dims: readonly number[];
}

export interface OcrModels {
  detect(tensor: Float32Array, dims: number[]): Promise<OcrTensor>;
  recognize(script: Script, tensor: Float32Array, dims: number[]): Promise<OcrTensor>;
  dictionaries: Record<Script, readonly string[]>;
}

export interface OcrLine {
  text: string;
  latin: string;
  arabic: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ARABIC_LETTER = /[ء-ي]/;

// Each line goes through both models, because the documents mix both scripts.
export async function readPage(image: RgbaImage, models: OcrModels): Promise<OcrLine[]> {
  const { tensor, dims, width, height } = prepareDetection(image);
  const { data } = await models.detect(tensor, dims);
  const boxes = findTextBoxes(data, width, height, image.width, image.height);
  const lines: OcrLine[] = [];

  for (const box of boxes) {
    const crop = cropImage(image, box.x, box.y, box.width, box.height);
    const input = prepareRecognition(crop);
    const read = async (script: Script) => {
      const output = await models.recognize(script, input.tensor, input.dims);
      return ctcDecode(output.data, output.dims, models.dictionaries[script]);
    };
    const latin = await read('latin');
    const arabic = await read('arabic');
    const arabicText = toReadingOrder(arabic.text);
    const useArabic = ARABIC_LETTER.test(arabicText) && arabic.confidence > latin.confidence;
    const best = useArabic ? { text: arabicText, confidence: arabic.confidence } : latin;

    lines.push({ ...box, text: best.text, confidence: best.confidence, latin: latin.text, arabic: arabicText });
  }
  return lines.sort((a, b) => a.y - b.y || a.x - b.x);
}
