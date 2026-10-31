import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { createId } from './uuid';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

const directory = () => new Directory(Paths.document, 'profile-photos');
const safeName = (name: string) => /^[a-f0-9]{64}\/[a-f0-9-]+\.jpg$/i.test(name);
const ownerHash = (owner: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, owner);
export const profilePhotos = {
  async choose(owner: string): Promise<string | null> {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    const asset = result.assets?.[0]; if (!asset) return null;
    const context = ImageManipulator.manipulate(asset.uri);
    context.resize({ width: 512 });
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
      const hash = await ownerHash(owner);
      new Directory(directory(), hash).create({ idempotent: true, intermediates: true });
      const name = `${hash}/${createId()}.jpg`;
      const target = new File(directory(), name); new File(saved.uri).copy(target);
      return name;
    } finally { image.release(); context.release(); }
  },
  uriOf(name: string) { if (!safeName(name)) return null; const file = new File(directory(), name); return file.exists ? file.uri : null; },
  remove(name: string) { try { if (safeName(name)) { const file = new File(directory(), name); if (file.exists) file.delete(); } } catch { /* Cleanup must not interrupt navigation. */ } },
  async clearOwner(owner: string) { const folder = new Directory(directory(), await ownerHash(owner)); if (folder.exists) folder.delete(); },
};
