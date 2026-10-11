import assert from 'node:assert/strict';
import test from 'node:test';

import { CorrelationIdMiddleware } from './correlation-id.middleware';

type TestRequest = {
  headers: Record<string, string>;
  correlationId?: string;
};

test('correlation middleware replaces a safe client-supplied identifier', () => {
  const middleware = new CorrelationIdMiddleware();
  const supplied = 'request_123-abc';
  const request: TestRequest = {
    headers: { 'x-correlation-id': supplied },
  };
  let headerValue = '';
  let nextCalled = false;

  middleware.use(
    request,
    { setHeader: (_name: string, value: string) => { headerValue = value; } },
    () => { nextCalled = true; },
  );

  assert.match(request.correlationId ?? '', /^[0-9a-f-]{36}$/i);
  assert.notEqual(request.correlationId, supplied);
  assert.equal(headerValue, request.correlationId);
  assert.equal(nextCalled, true);
});

test('correlation middleware replaces an unsafe client-supplied identifier', () => {
  const middleware = new CorrelationIdMiddleware();
  const request: TestRequest = {
    headers: { 'x-correlation-id': 'unsafe\r\nheader' },
  };
  let headerValue = '';

  middleware.use(
    request,
    { setHeader: (_name: string, value: string) => { headerValue = value; } },
    () => undefined,
  );

  assert.match(request.correlationId ?? '', /^[0-9a-f-]{36}$/i);
  assert.equal(headerValue, request.correlationId);
});
