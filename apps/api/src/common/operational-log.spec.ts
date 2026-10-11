import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOperationalEvent,
  buildRequestOperationalEvent,
  safeOperationalPath,
  serializeOperationalEvent,
  startupFailureReason,
} from './operational-log';

test('operational paths strip query strings and fragments', () => {
  assert.equal(
    safeOperationalPath('/api/v1/projects?token=secret#ignored'),
    '/api/v1/projects',
  );
});

test('request events are machine-readable and retain server correlation', () => {
  const event = buildRequestOperationalEvent({
    method: 'get',
    url: '/api/v1/projects?password=secret',
    statusCode: 200,
    durationMs: 12.34567,
    correlationId: 'server-correlation',
    timestamp: '2026-10-11T00:00:00.000Z',
  });

  assert.deepEqual(event, {
    timestamp: '2026-10-11T00:00:00.000Z',
    event: 'http.request',
    method: 'GET',
    path: '/api/v1/projects',
    status: 200,
    durationMs: 12.346,
    correlationId: 'server-correlation',
  });
  assert.equal(JSON.stringify(event).includes('password=secret'), false);
});

test('login request events record outcome without identity or credentials', () => {
  const event = buildRequestOperationalEvent({
    method: 'post',
    url: '/api/v1/auth/login?email=user@example.com',
    statusCode: 401,
    durationMs: 4,
    correlationId: 'corr-2',
    timestamp: '2026-10-11T00:00:00.000Z',
  });

  assert.equal(event.event, 'auth.login');
  assert.equal(event.outcome, 'failure');
  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes('user@example.com'), false);
  assert.equal(serialized.includes('password'), false);
});

test('operational serialization omits undefined fields', () => {
  const line = serializeOperationalEvent(
    'service.start',
    { nodeEnv: 'test', omitted: undefined },
    '2026-10-11T00:00:00.000Z',
  );
  assert.deepEqual(JSON.parse(line), {
    timestamp: '2026-10-11T00:00:00.000Z',
    event: 'service.start',
    nodeEnv: 'test',
  });
});

test('operational event builder preserves only explicit low-cardinality fields', () => {
  assert.deepEqual(
    buildOperationalEvent(
      'migration.start',
      { releaseCommit: 'abc123', deploymentMode: 'upgrade' },
      '2026-10-11T00:00:00.000Z',
    ),
    {
      timestamp: '2026-10-11T00:00:00.000Z',
      event: 'migration.start',
      releaseCommit: 'abc123',
      deploymentMode: 'upgrade',
    },
  );
});

test('startup failure reasons are classified without exposing raw messages', () => {
  assert.equal(
    startupFailureReason(
      new Error('Production document storage sentinel is missing; refusing startup because persistent storage may be unavailable.'),
    ),
    'storage_sentinel_missing_or_invalid',
  );
  assert.equal(
    startupFailureReason(new Error('WEB_ORIGIN must use HTTPS when NODE_ENV=production.')),
    'web_origin_requires_https',
  );
  assert.equal(
    startupFailureReason(new Error('password=super-secret')),
    'startup_failed',
  );
});
