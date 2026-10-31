import type { CrashClassifier } from '../model/crashModelMonitor';

// The web has no crash sensors or ONNX Runtime.
export const classifyCrash: CrashClassifier = async () => null;
