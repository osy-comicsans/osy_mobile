import * as DocumentPicker from 'expo-document-picker';

import type { CaptureResult } from './documentCapture';

export type { CaptureResult, PickedFile } from './documentCapture';

// Web previews have no camera flow or file cache.
export async function scanPage(): Promise<CaptureResult> {
  return { status: 'cameraDenied', canAskAgain: false };
}

export async function pickFile(): Promise<CaptureResult> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'] });
  const asset = result.assets?.[0];
  if (!asset) return { status: 'canceled' };
  return {
    status: 'picked',
    file: { uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType ?? '', sizeBytes: asset.size ?? 0 },
  };
}

export const pickPhoto = pickFile;

export function deleteCapturedFiles() {}
