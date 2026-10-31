import { CanceledError, isAxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { ApiError } from './apiError';
import type { AuthSession, AuthTokens } from './authSession';

type RetriableConfig = InternalAxiosRequestConfig & { retriedAfterRefresh?: boolean };

export function installAuthInterceptors(
  client: AxiosInstance,
  session: AuthSession,
  refreshTokens: (refreshToken: string) => Promise<AuthTokens>,
): void {
  let refreshing: Promise<string | null> | undefined;

  const runRefresh = async (): Promise<string | null> => {
    const refreshToken = session.getTokens()?.refreshToken;
    if (!refreshToken) return null;

    try {
      const next = await refreshTokens(refreshToken);
      // The user may have signed out while this request was in flight.
      if (session.getTokens()?.refreshToken !== refreshToken) return session.getTokens()?.accessToken ?? null;
      await session.save(next);
      return next.accessToken;
    } catch (error) {
      // Only an explicit rejection ends the session. Being offline must not
      // sign out a local-first user.
      if (error instanceof ApiError && error.kind === 'unauthorized'
        && session.getTokens()?.refreshToken === refreshToken) {
        await session.clear();
      }
      throw error;
    }
  };

  // Concurrent 401s share one refresh, because refresh tokens are single use.
  const refresh = () => {
    refreshing ??= runRefresh().finally(() => { refreshing = undefined; });
    return refreshing;
  };

  client.interceptors.request.use(async (request) => {
    await session.restore();
    const owner = request.headers.get('X-OSY-Owner');
    if (owner && owner !== session.status.getState().userId) throw new CanceledError('Account changed.');
    const accessToken = session.getTokens()?.accessToken;
    if (accessToken) request.headers.set('Authorization', `Bearer ${accessToken}`);
    return request;
  });

  client.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401) throw error;
    const request = error.config as RetriableConfig | undefined;
    if (!request || request.retriedAfterRefresh) throw error;
    const owner = request.headers.get('X-OSY-Owner');
    if (owner && owner !== session.status.getState().userId) throw new CanceledError('Account changed.');

    // A request that was sent with an older token only needs a retry.
    const current = session.getTokens()?.accessToken;
    const sentCurrent = request.headers.get('Authorization') === `Bearer ${current}`;
    const accessToken = current && !sentCurrent ? current : await refresh().catch(() => null);
    if (!accessToken) throw error;

    return client.request({ ...request, retriedAfterRefresh: true } as RetriableConfig);
  });
}
