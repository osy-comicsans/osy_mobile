// Web previews do not persist photos or medical information on disk.
export const profilePhotos = {
  choose: async (_owner: string): Promise<string | null> => null,
  uriOf: (_name: string): string | null => null,
  remove: (_name: string) => {},
  clearOwner: async (_owner: string) => {},
};
