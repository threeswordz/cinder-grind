import { z } from 'zod';

import { apiRequest, setCsrfToken } from './client';

const currentUserSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    email: z.string(),
    displayName: z.string(),
    roleCodes: z.array(z.string()),
    permissions: z.array(z.string()),
  }),
});

const loginSchema = z.object({
  data: z.object({
    user: z.object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
      email: z.string(),
      displayName: z.string(),
    }),
    csrfToken: z.string(),
    expiresAt: z.string(),
  }),
});

export type CurrentUser = z.infer<typeof currentUserSchema>['data'];

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return currentUserSchema.parse(
    await apiRequest<unknown>('/auth/me'),
  ).data;
}

export async function login(
  email: string,
  password: string,
): Promise<void> {
  const result = loginSchema.parse(
    await apiRequest<unknown>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  );
  setCsrfToken(result.data.csrfToken);
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
  setCsrfToken(null);
}
