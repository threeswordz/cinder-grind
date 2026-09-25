import assert from 'node:assert/strict';
import test from 'node:test';

import { CorrelationIdMiddleware } from './correlation-id.middleware';

test('correlation middleware preserves a safe supplied identifier', () => {
  const middleware = new CorrelationIdMiddleware();
  const request = { headers: { 'x-correlation-id': 'request_123-abc' } };
  let headerValue = '';
  let nextCalled = false;

  middleware.use(
    request,
    { setHeader: (_name: string, value: string) => { headerValue = value; } },
    () => { nextCalled = true; },
  );

  assert.equal(request.correlationId, 'request_123-abc');
  assert.equal(headerValue, 'request_123-abc');
  assert.equal(nextCalled, true);
});

test('correlation middleware replaces unsafe supplied identifiers', () => {
  const middleware = new CorrelationIdMiddleware();
  const request = { headers: { 'x-correlation-id': 'unsafe\r\nheader' } };
  let headerValue = '';

  middleware.use(
    request,
    { setHeader: (_name: string, value: string) => { headerValue = value; } },
    () => undefined,
  );

  assert.match(request.correlationId ?? '', /^[0-9a-f-]{36}$/i);
  assert.equal(headerValue, request.correlationId);
});
