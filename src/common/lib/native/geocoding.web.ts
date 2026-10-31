// Expo's native reverse geocoder is not available on web. Coordinates and
// matching road names remain usable without introducing another provider.
export async function reverseGeocodeArea(_point: { latitude: number; longitude: number }): Promise<{
  district: string | null; city: string | null; region: string | null;
} | null> { return null; }
