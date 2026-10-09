import assert from 'node:assert/strict';
import test from 'node:test';

import { productionErrorLogContext, safeRequestPath } from './problem-details.filter';

test('problem details strip query strings from request instance paths', () => {
  assert.equal(
    safeRequestPath('/api/v1/example?sessionToken=secret&password=hidden'),
    '/api/v1/example',
  );
});

test('production error log context excludes exception messages and query secrets', () => {
  const secret = 'password=super-secret';
  const context = productionErrorLogContext(new Error(secret), {
    url: '/api/v1/example?token=secret',
    correlationId: 'corr-1',
  });
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('token=secret'), false);
  assert.deepEqual(context, {
    errorName: 'Error',
    path: '/api/v1/example',
    correlationId: 'corr-1',
  });
});
