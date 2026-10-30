import type { AxiosInstance } from 'axios';

import { parseResponse } from '@/common/lib/api/apiError';
import type { AuthSession } from '@/common/lib/api/authSession';

import {
  authResponseSchema, documentsResponseSchema, loginRequestSchema, registerRequestSchema,
  type DocumentUpload, type LoginRequest, type RegisterRequest, type User,
} from '../types/auth.schemas';

export function createAuthApi(publicClient: AxiosInstance, session: AuthSession) {
  const signIn = async (path: string, body: unknown): Promise<User> => {
    const { user, accessToken, refreshToken } = await parseResponse(
      publicClient.post(path, body), authResponseSchema,
    );
    await session.save({ accessToken, refreshToken });
    return user;
  };

  return {
    register: (request: RegisterRequest) => signIn('/auth/register', registerRequestSchema.parse(request)),
    login: (request: LoginRequest) => signIn('/auth/login', loginRequestSchema.parse(request)),
    signOut: () => session.clear(),
  };
}

export function createDocumentsApi(client: AxiosInstance) {
  return {
    list: () => parseResponse(client.get('/me/documents'), documentsResponseSchema),

    upload({ type, source, uri, fileName, mimeType, captureLanguage, fields }: DocumentUpload) {
      const form = new FormData();
      form.append('type', type);
      form.append('source', source);
      form.append('captureLanguage', captureLanguage);
      form.append('fields', JSON.stringify(fields));
      // React Native's FormData accepts a file descriptor in place of a Blob.
      form.append('file', { uri, name: fileName, type: mimeType } as unknown as Blob);
      return parseResponse(
        client.post('/me/documents', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60_000,
        }),
        documentsResponseSchema,
      );
    },
  };
}
