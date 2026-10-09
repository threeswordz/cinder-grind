import assert from 'node:assert/strict';
import test from 'node:test';

import { securityHeadersMiddleware } from './security-headers';

test('security middleware emits defensive API headers and Production HSTS', () => {
  const headers = new Map<string, string>();
  let nextCalled = false;
  securityHeadersMiddleware(true)(
    {},
    { setHeader: (name, value) => headers.set(name, value) },
    () => { nextCalled = true; },
  );

  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.match(headers.get('Content-Security-Policy') ?? '', /frame-ancestors 'none'/);
  assert.equal(nextCalled, true);
});
