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

const ONBOARDING_KEY = 'osy.auth.onboardingComplete';

export function createAccountService({ session, listDocuments, storage }: AccountOptions) {
  const store = createStore<AccountState>(() => ({ phase: 'loading', documents: [], loadFailed: false }));

  const apply = ({ documents, onboardingStatus }: DocumentsResponse) => {
    const complete = onboardingStatus === 'complete';
    if (complete) storage.setItem(ONBOARDING_KEY, '1');
    else storage.removeItem(ONBOARDING_KEY);
    store.setState({ documents, phase: complete ? 'ready' : 'onboarding', loadFailed: false });
  };

  const refresh = async () => {
    try {
      apply(await listDocuments());
    } catch {
      // A safety app must still open offline for someone who finished onboarding.
      const { phase } = store.getState();
      if (phase === 'signedOut') return;
      const remembered = storage.getItem(ONBOARDING_KEY) !== null;
      store.setState({ loadFailed: true, phase: remembered ? 'ready' : 'onboarding' });
    }
  };

  const sync = (status: string) => {
    if (status === 'signedOut') {
      storage.removeItem(ONBOARDING_KEY);
      store.setState({ phase: 'signedOut', documents: [], loadFailed: false });
    } else if (status === 'signedIn') {
      if (storage.getItem(ONBOARDING_KEY) !== null) store.setState({ phase: 'ready' });
      void refresh();
    }
  };

  return {
    store,
    apply,
    refresh,

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
