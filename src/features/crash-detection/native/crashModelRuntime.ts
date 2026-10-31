import { Asset } from 'expo-asset';
import { NativeModules } from 'react-native';

import type { CrashClassifier } from '../model/crashModelMonitor';

type Ort = typeof import('onnxruntime-react-native');
type Session = Awaited<ReturnType<Ort['InferenceSession']['create']>>;

async function loadSession() {
  // Expo Go has no ONNX Runtime, so detection stays on the rules there.
  if (!NativeModules.Onnxruntime) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ort = require('onnxruntime-react-native') as Ort;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { localUri } = await Asset.fromModule(require('@/assets/models/vzcrash_xgb.onnx')).downloadAsync();
  if (!localUri) return null;
  const session = await ort.InferenceSession.create(localUri.replace('file://', ''));
  return { ort, session };
}

let loading: Promise<{ ort: Ort; session: Session } | null> | undefined;

export const classifyCrash: CrashClassifier = async (features) => {
  // A failed load is not kept, so the error reaches the caller and the next call retries.
  loading ??= loadSession().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  const runtime = await loading;
  if (!runtime) return null;

  const { ort, session } = runtime;
  const output = await session.run({ input: new ort.Tensor('float32', features, [1, features.length]) });
  const [crash, nearMiss, normal] = output.probabilities.data as Float32Array;
  return { crash, nearMiss, normal };
};
