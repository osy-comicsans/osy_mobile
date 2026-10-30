import { isAxiosError, isCancel, type AxiosResponse } from 'axios';
import { z } from 'zod';

export type ApiErrorKind =
  | 'canceled' | 'network' | 'unauthorized' | 'conflict' | 'validation'
  | 'rate_limited' | 'server' | 'request' | 'invalid_response';

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

// Carries only the server's error details. Axios errors keep the request body,
// which can hold passwords or document data, so they must not reach callers.
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  return status >= 500 ? 'server' : 'request';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isCancel(error)) return new ApiError('canceled', 'The request was canceled.');
  if (!isAxiosError(error)) return new ApiError('request', 'The request could not be completed.');
  if (!error.response) return new ApiError('network', 'Could not reach the server.');

  const { status, data } = error.response;
  const body = errorBodySchema.safeParse(data);
  return new ApiError(
    kindForStatus(status),
    body.success ? body.data.error.message : 'The server rejected the request.',
    status,
    body.success ? body.data.error.code : undefined,
    body.success ? body.data.error.fields : undefined,
  );
}

export async function parseResponse<T>(
  request: Promise<AxiosResponse<unknown>>,
  schema: z.ZodType<T>,
): Promise<T> {
  let data: unknown;
  try {
    ({ data } = await request);
  } catch (error) {
    throw toApiError(error);
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError('invalid_response', 'The server sent an unexpected response.');
  return parsed.data;
}

export async function sendRequest(request: Promise<AxiosResponse<unknown>>): Promise<void> {
  try {
    await request;
  } catch (error) {
    throw toApiError(error);
  }
}
