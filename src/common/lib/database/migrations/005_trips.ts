// Only the trip under way lives here, so a restart does not lose it. Finished
// trips wait in the sync queue. Totals only: a trip never stores where it went.
export const tripsSchema = `
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  distance_meters REAL NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0
);
`;
