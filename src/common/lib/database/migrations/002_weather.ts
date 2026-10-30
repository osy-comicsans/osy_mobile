export const weatherSchema = `
CREATE TABLE IF NOT EXISTS weather_cache (
  area_id TEXT PRIMARY KEY NOT NULL,
  fetched_at INTEGER NOT NULL,
  valid_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS weather_cache_fetched ON weather_cache(fetched_at DESC);
`;
