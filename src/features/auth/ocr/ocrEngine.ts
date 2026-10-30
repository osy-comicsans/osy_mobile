/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs literal requires for bundled models. */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import type { RgbaImage } from './paddle/image';
import type { OcrModels, Script } from './paddle/pipeline';

type Ort = typeof import('onnxruntime-react-native');
type Session = Awaited<ReturnType<Ort['InferenceSession']['create']>>;

const MAX_IMAGE_SIDE = 1600;

async function assetPath(moduleId: number): Promise<string> {
  const { localUri } = await Asset.fromModule(moduleId).downloadAsync();
  if (!localUri) throw new Error('Model asset is unavailable.');
  return localUri;
}

async function dictionary(moduleId: number): Promise<string[]> {
  return (await new File(await assetPath(moduleId)).text()).split(/\r?\n/).filter((line, index, all) => (
    line !== '' || index < all.length - 1
  ));
}

async function loadModels(): Promise<OcrModels> {
  // Loaded late, because Expo Go has no native ONNX Runtime and must still open.
  const ort = require('onnxruntime-react-native') as Ort;
  const session = async (moduleId: number) => ort.InferenceSession.create(
    (await assetPath(moduleId)).replace('file://', ''),
  );
  const run = async (model: Session, tensor: Float32Array, dims: number[]) => {
    const input = new ort.Tensor('float32', tensor, dims);
    const output = await model.run({ [model.inputNames[0]]: input });
    const { data, dims: outputDims } = output[model.outputNames[0]];
    return { data: data as Float32Array, dims: outputDims };
  };

  const [detector, latin, arabic, latinDictionary, arabicDictionary] = await Promise.all([
    session(require('@/assets/ocr/det.onnx')),
    session(require('@/assets/ocr/latin_rec.onnx')),
    session(require('@/assets/ocr/arabic_rec.onnx')),
    dictionary(require('@/assets/ocr/latin_dict.txt')),
    dictionary(require('@/assets/ocr/arabic_dict.txt')),
  ]);
  const recognizers: Record<Script, Session> = { latin, arabic };

  return {
    detect: (tensor, dims) => run(detector, tensor, dims),
    recognize: (script, tensor, dims) => run(recognizers[script], tensor, dims),
    dictionaries: { latin: latinDictionary, arabic: arabicDictionary },
  };
}

let models: Promise<OcrModels | null> | undefined;

export function getOcrModels(): Promise<OcrModels | null> {
  models ??= loadModels().catch(() => null);
  return models;
}

export async function loadPageImage(uri: string, width: number): Promise<RgbaImage> {
  const context = ImageManipulator.manipulate(uri);
  if (width > MAX_IMAGE_SIDE) context.resize({ width: MAX_IMAGE_SIDE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  const file = new File(saved.uri);
  try {
    const { width: decodedWidth, height, data } = decode(await file.bytes(), { useTArray: true, formatAsRGBA: true });
    return { width: decodedWidth, height, data };
  } finally {
    // This copy holds the document, so it must not outlive the read.
    if (file.exists) file.delete();
  }
}
