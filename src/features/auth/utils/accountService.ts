import { createStore } from 'zustand/vanilla';

import type { AuthSession } from '@/common/lib/api/authSession';

import type { DocumentRecord, DocumentsResponse } from '../types/auth.schemas';

// `ready` is the only phase that can reach the tabs.
export type AccountPhase = 'loading' | 'signedOut' | 'onboarding' | 'ready';

export interface AccountState {
  phase: AccountPhase;
  documents: DocumentRecord[];
  loadFailed: boolean;
}

interface AccountOptions {
  session: AuthSession;
  listDocuments: () => Promise<DocumentsResponse>;
  storage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
}

// Onboarding belongs to sign-up. It is remembered so quitting halfway resumes it,
// and logging in never starts it.
const SIGN_UP_KEY = 'osy.auth.signUpPending';

export function createAccountService({ session, listDocuments, storage }: AccountOptions) {
  const store = createStore<AccountState>(() => ({ phase: 'loading', documents: [], loadFailed: false }));

  const pending = () => storage.getItem(SIGN_UP_KEY) !== null;

  const apply = ({ documents, onboardingStatus }: DocumentsResponse) => {
    if (onboardingStatus === 'complete') storage.removeItem(SIGN_UP_KEY);
    store.setState({ documents, phase: pending() ? 'onboarding' : 'ready', loadFailed: false });
  };

  const refresh = async () => {
    try {
      apply(await listDocuments());
    } catch {
      const { phase } = store.getState();
      if (phase === 'signedOut' && session.status.getState().status !== 'signedIn') return;
      store.setState({ loadFailed: true, phase: pending() ? 'onboarding' : 'ready' });
    }
  };

  const sync = (status: string) => {
    if (status === 'signedOut') {
      storage.removeItem(SIGN_UP_KEY);
      store.setState({ phase: 'signedOut', documents: [], loadFailed: false });
    } else if (status === 'signedIn') {
      store.setState({ phase: pending() ? 'onboarding' : 'ready' });
      void refresh();
    }
  };

  return {
    store,
    apply,
    refresh,
    beginSignUp: () => storage.setItem(SIGN_UP_KEY, '1'),
    cancelSignUp: () => storage.removeItem(SIGN_UP_KEY),

    start() {
      const unsubscribe = session.status.subscribe((state, previous) => {
        if (state.status !== previous.status) sync(state.status);
      });
      void session.restore().then(() => {
        if (store.getState().phase === 'loading') sync(session.status.getState().status);
      });
      return unsubscribe;
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
