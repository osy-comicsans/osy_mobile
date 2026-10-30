import { z } from 'zod';
import { createStore } from 'zustand/vanilla';

const ACCESS_TOKEN_KEY = 'osy.auth.accessToken';
const REFRESH_TOKEN_KEY = 'osy.auth.refreshToken';

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
  const status = createStore<{ status: AuthStatus }>(() => ({ status: 'unknown' }));
  let tokens: AuthTokens | null = null;
  let restoring: Promise<void> | undefined;

  const load = async () => {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        storage.getItem(ACCESS_TOKEN_KEY),
        storage.getItem(REFRESH_TOKEN_KEY),
      ]);
      if (tokens) return;
      tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
      status.setState({ status: tokens ? 'signedIn' : 'signedOut' });
    } catch {
      // Keep whatever is stored: an unavailable keychain is not a sign-out.
      if (!tokens) status.setState({ status: 'signedOut' });
    }
  };

  return {
    status,
    getTokens: () => tokens,

    restore(): Promise<void> {
      restoring ??= load();
      return restoring;
    },

    async save(next: AuthTokens): Promise<void> {
      await storage.setItem(ACCESS_TOKEN_KEY, next.accessToken);
      await storage.setItem(REFRESH_TOKEN_KEY, next.refreshToken);
      tokens = next;
      status.setState({ status: 'signedIn' });
    },

    async clear(): Promise<void> {
      tokens = null;
      status.setState({ status: 'signedOut' });
      await Promise.all([storage.removeItem(ACCESS_TOKEN_KEY), storage.removeItem(REFRESH_TOKEN_KEY)]);
    },
  };
}

export type AuthSession = ReturnType<typeof createAuthSession>;
