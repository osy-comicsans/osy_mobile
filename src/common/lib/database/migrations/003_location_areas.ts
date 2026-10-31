export const locationAreasSchema = `
CREATE TABLE IF NOT EXISTS location_areas (
  area_key TEXT PRIMARY KEY NOT NULL,
  updated_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
`;
