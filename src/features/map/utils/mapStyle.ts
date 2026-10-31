// OpenFreeMap needs no API key. It is OpenStreetMap data, the same as OSRM.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export function mapStyleUrl(scheme: string | null | undefined): string {
  return scheme === 'dark' ? STYLES.dark : STYLES.light;
}

// Algiers, until the first GPS fix arrives.
export const DEFAULT_CENTER: [number, number] = [3.0588, 36.7538];
export const DEFAULT_ZOOM = 11;
export const FOLLOW_ZOOM = 16;
export const ROUTE_ZOOM = 13;
