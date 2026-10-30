export const syncPolicy = {
  baseRetryMs: 1_000,
  maxRetryMs: 5 * 60_000,
  foregroundIntervalMs: 30_000,
  batchSize: 50,
} as const;

export function getRetryDelay(retryCount: number, random = Math.random): number {
  const exponential = syncPolicy.baseRetryMs * 2 ** Math.min(Math.max(retryCount - 1, 0), 20);
  return Math.min(syncPolicy.maxRetryMs, Math.round(exponential * (0.8 + random() * 0.4)));
}
