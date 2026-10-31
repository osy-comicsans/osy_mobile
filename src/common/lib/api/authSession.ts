import { z } from 'zod';
import { createStore } from 'zustand/vanilla';

const ACCESS_TOKEN_KEY = 'osy.auth.accessToken';
const REFRESH_TOKEN_KEY = 'osy.auth.refreshToken';
const USER_ID_KEY = 'osy.auth.userId';

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthStatus = 'unknown' | 'signedIn' | 'signedOut';

interface TokenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createAuthSession(storage: TokenStorage) {
  const status = createStore<{ status: AuthStatus; userId: string | null }>(() => ({ status: 'unknown', userId: null }));
  let tokens: AuthTokens | null = null;
  let restoring: Promise<void> | undefined;
  let epoch = 0;
  let writes: Promise<unknown> = Promise.resolve();
  const persist = <T>(action: () => Promise<T>) => {
    const result = writes.then(action); writes = result.catch(() => undefined); return result;
  };

  const load = async () => {
    const id = epoch;
    try {
      const [accessToken, refreshToken, userId] = await Promise.all([
        storage.getItem(ACCESS_TOKEN_KEY),
        storage.getItem(REFRESH_TOKEN_KEY),
        storage.getItem(USER_ID_KEY),
      ]);
      if (tokens || id !== epoch) return;
      tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
      status.setState({ status: tokens ? 'signedIn' : 'signedOut', userId: tokens ? userId : null });
    } catch {
      // Keep whatever is stored: an unavailable keychain is not a sign-out.
      if (!tokens && id === epoch) status.setState({ status: 'signedOut', userId: null });
    }
  };

  return {
    status,
    getTokens: () => tokens,

    restore(): Promise<void> {
      restoring ??= load();
      return restoring;
    },

    async save(next: AuthTokens, userId?: string): Promise<void> {
      const id = ++epoch;
      await persist(async () => {
        await storage.setItem(ACCESS_TOKEN_KEY, next.accessToken);
        await storage.setItem(REFRESH_TOKEN_KEY, next.refreshToken);
        if (userId) await storage.setItem(USER_ID_KEY, userId);
      });
      if (id !== epoch) return;
      tokens = next;
      status.setState({ status: 'signedIn', ...(userId ? { userId } : {}) });
    },

    async rememberUserId(userId: string) {
      const current = tokens; if (!current) return;
      await persist(async () => { if (tokens === current) await storage.setItem(USER_ID_KEY, userId); });
      if (tokens === current) status.setState({ userId });
    },

    async clear(): Promise<void> {
      epoch++;
      tokens = null;
      status.setState({ status: 'signedOut', userId: null });
      await persist(() => Promise.all([storage.removeItem(ACCESS_TOKEN_KEY), storage.removeItem(REFRESH_TOKEN_KEY), storage.removeItem(USER_ID_KEY)]));
    },
  };
}

export type AuthSession = ReturnType<typeof createAuthSession>;
