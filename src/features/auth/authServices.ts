import { api, authSession, publicApi } from '@/common/lib/api/axios';
import { languageStorage } from '@/common/lib/i18n/languageStorage';
import { createProfileApi } from '@/features/profile/api/profileApi';

import { createAuthApi, createDocumentsApi } from './api/authApi';
import { createAccountService } from './utils/accountService';

export const authApi = createAuthApi(publicApi, authSession);
export const documentsApi = createDocumentsApi(api);
export const profileApi = createProfileApi(api, () => authSession.status.getState().userId);
export const accountService = createAccountService({
  session: authSession,
  listDocuments: documentsApi.list,
  storage: languageStorage,
});
