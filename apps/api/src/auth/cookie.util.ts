export const SESSION_COOKIE_NAME = 'erp_session';

const SAFE_COOKIE_VALUE = /^[A-Za-z0-9_-]{20,256}$/;

export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;

    const name = trimmed.slice(0, separator);
    if (name !== SESSION_COOKIE_NAME) continue;

    const value = trimmed.slice(separator + 1);
    return SAFE_COOKIE_VALUE.test(value) ? value : null;
  }

  return null;
}

export function buildSessionCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  if (!SAFE_COOKIE_VALUE.test(token)) {
    throw new Error('Session token contains characters that are not cookie-safe.');
  }

  const boundedMaxAge = Math.max(0, Math.floor(maxAgeSeconds));
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${boundedMaxAge}`,
    secure ? 'Secure' : null,
  ]
    .filter((part): part is string => part !== null)
    .join('; ');
}

export function buildClearedSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : null,
  ]
    .filter((part): part is string => part !== null)
    .join('; ');
}
