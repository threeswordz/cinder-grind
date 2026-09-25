export type AuthenticatedUserContext = {
  sessionId: string;
  userId: string;
  companyId: string;
  email: string;
  displayName: string;
  roleCodes: string[];
  permissions: string[];
  csrfTokenHash: string;
};

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
  auth?: AuthenticatedUserContext;
};
