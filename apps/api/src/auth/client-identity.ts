import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import { trustedProxyAddresses } from '../production-config';
import { AuthenticatedRequest } from './auth.types';

function normalizeAddress(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const mapped = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  return isIP(mapped) > 0 ? mapped : null;
}

export function resolveClientAddress(
  request: AuthenticatedRequest,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const peer = normalizeAddress(request.socket?.remoteAddress) ?? 'unknown';
  if (peer === 'unknown' || !trustedProxyAddresses(env).has(peer)) return peer;

  const forwarded = request.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded.join(',') : forwarded;
  if (!raw) return peer;

  const chain = raw
    .split(',')
    .map((item) => normalizeAddress(item))
    .filter((item): item is string => item !== null);

  return chain.at(-1) ?? peer;
}

export function loginRateLimitKey(
  request: AuthenticatedRequest,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return createHash('sha256')
    .update(`login:${resolveClientAddress(request, env)}`)
    .digest('hex');
}
