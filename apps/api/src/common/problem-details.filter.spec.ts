import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { monetaryPolicyException } from './monetary-policy';

import { productionErrorLogContext, safeRequestPath } from './problem-details.filter';

test('monetary policy database denials become safe 422 contracts without leaking SQL', () => {
  const error = new Prisma.PrismaClientKnownRequestError('private SQL / password', {
    code: 'P2004', clientVersion: 'test', meta: { database_error: 'ERP_THB_PROVENANCE_REQUIRED private SQL / password' },
  });
  const policy = monetaryPolicyException(error);
  assert.equal(policy?.getStatus(), 422);
  assert.equal(JSON.stringify(policy?.getResponse()).includes('private SQL'), false);
  assert.equal(monetaryPolicyException(new Error('ERP_THB_COMPANY_REQUIRED')), undefined);
  const postgresError = new Prisma.PrismaClientUnknownRequestError(
    'private SQL; PostgresError { code: "P1201", message: "ERP_THB_COMPANY_REQUIRED", severity: "ERROR" }',
    { clientVersion: 'test' },
  );
  assert.equal(monetaryPolicyException(postgresError)?.getStatus(), 422);
  assert.equal(JSON.stringify(monetaryPolicyException(postgresError)?.getResponse()).includes('private SQL'), false);
  assert.equal(monetaryPolicyException(new Prisma.PrismaClientUnknownRequestError(
    'ERP_THB_COMPANY_REQUIRED arbitrary exception', { clientVersion: 'test' },
  )), undefined);
});

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
