export type OperationalLogValue = string | number | boolean;
export type OperationalLogFields = Record<string, OperationalLogValue | undefined>;

export function safeOperationalPath(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url, 'http://local.invalid').pathname;
  } catch {
    return '';
  }
}

export function buildOperationalEvent(
  event: string,
  fields: OperationalLogFields = {},
  timestamp = new Date().toISOString(),
): Record<string, OperationalLogValue> {
  const compactFields: Record<string, OperationalLogValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) compactFields[key] = value;
  }
  return { timestamp, event, ...compactFields };
}

export function serializeOperationalEvent(
  event: string,
  fields: OperationalLogFields = {},
  timestamp?: string,
): string {
  return JSON.stringify(buildOperationalEvent(event, fields, timestamp));
}

export function buildRequestOperationalEvent(input: {
  method?: string | undefined;
  url?: string | undefined;
  statusCode: number;
  durationMs: number;
  correlationId?: string | undefined;
  timestamp?: string | undefined;
}): Record<string, OperationalLogValue> {
  const path = safeOperationalPath(input.url);
  const isLogin = path === '/api/v1/auth/login';
  const fields: OperationalLogFields = {
    method: (input.method ?? '').toUpperCase(),
    path,
    status: input.statusCode,
    durationMs: Math.max(0, Math.round(input.durationMs * 1000) / 1000),
    correlationId: input.correlationId ?? '',
  };
  if (isLogin) fields.outcome = input.statusCode < 400 ? 'success' : 'failure';

  return buildOperationalEvent(
    isLogin ? 'auth.login' : 'http.request',
    fields,
    input.timestamp,
  );
}
