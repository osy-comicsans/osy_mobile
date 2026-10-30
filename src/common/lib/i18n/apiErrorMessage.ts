import type { ApiError } from '@/common/lib/api/apiError';

import { i18n } from './i18n';

// The server's message can be in another language, so the text follows the error kind.
export function apiErrorMessage(error: ApiError): string {
  return i18n.t(`errors.api.${error.kind}`);
}
