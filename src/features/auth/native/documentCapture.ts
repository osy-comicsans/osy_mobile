import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface PickedFile {
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type CaptureResult =
  | { status: 'picked'; file: PickedFile }
  | { status: 'canceled' }
  | { status: 'cameraDenied'; canAskAgain: boolean };

const fromImage = (result: ImagePicker.ImagePickerResult): CaptureResult => {
  const asset = result.assets?.[0];
  if (!asset) return { status: 'canceled' };
  return {
    status: 'picked',
    file: {
      uri: asset.uri,
      fileName: asset.fileName ?? 'document.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: asset.fileSize ?? 0,
    },
  };
};

const imageOptions = { mediaTypes: 'images', quality: 0.8 } as const;

export async function scanPage(): Promise<CaptureResult> {
  const { granted, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) return { status: 'cameraDenied', canAskAgain };
  return fromImage(await ImagePicker.launchCameraAsync(imageOptions));
}

export async function pickPhoto(): Promise<CaptureResult> {
  return fromImage(await ImagePicker.launchImageLibraryAsync(imageOptions));
}

export async function pickFile(): Promise<CaptureResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'application/pdf'],
    copyToCacheDirectory: true,
  });
  const asset = result.assets?.[0];
  if (!asset) return { status: 'canceled' };
  return {
    status: 'picked',
    file: {
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType ?? '',
      sizeBytes: asset.size ?? 0,
    },
  };
}

// Identity documents must not stay in the cache once they are uploaded or discarded.
export function deleteCapturedFiles(uris: string[]) {
  for (const uri of uris) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // A leftover cache file must not fail the flow. The system can clear it.
    }
  }
}
