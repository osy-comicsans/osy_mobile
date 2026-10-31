import { Directory, File, Paths } from 'expo-file-system';

const folder = () => new Directory(Paths.document, 'report-photos');

// iOS can move the app's folder on an update, so only the file name is queued.
export const reportPhotos = {
  keep(uri: string, name: string) {
    const directory = folder();
    directory.create({ idempotent: true });
    new File(uri).copy(new File(directory, name));
  },

  uriOf(name: string) {
    const file = new File(folder(), name);
    return file.exists ? file.uri : null;
  },

  remove(name: string) {
    try {
      const file = new File(folder(), name);
      if (file.exists) file.delete();
    } catch {
      // A leftover file must not stop the queue.
    }
  },
};
