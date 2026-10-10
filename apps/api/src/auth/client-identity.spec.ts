import assert from 'node:assert/strict';
import test from 'node:test';

import { loginRateLimitKey, resolveClientAddress } from './client-identity';

test('client identity ignores spoofed forwarding headers from untrusted peers', () => {
  const request = {
    headers: { 'x-forwarded-for': '203.0.113.10' },
    socket: { remoteAddress: '198.51.100.20' },
  };
  assert.equal(
    resolveClientAddress(request, { TRUSTED_PROXY_ADDRESSES: '127.0.0.1' }),
    '198.51.100.20',
  );
});

test('client identity accepts the right-most forwarded address from a trusted proxy', () => {
  const request = {
    headers: { 'x-forwarded-for': '192.0.2.8, 203.0.113.10' },
    socket: { remoteAddress: '::ffff:127.0.0.1' },
  };
  assert.equal(
    resolveClientAddress(request, { TRUSTED_PROXY_ADDRESSES: '127.0.0.1,::1' }),
    '203.0.113.10',
  );
});

test('rate-limit key hashes client identity instead of storing raw IP addresses', () => {
  const request = { headers: {}, socket: { remoteAddress: '198.51.100.20' } };
  const key = loginRateLimitKey(request, { TRUSTED_PROXY_ADDRESSES: '127.0.0.1' });
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key.includes('198.51.100.20'), false);
});
