import assert from 'node:assert/strict';
import test from 'node:test';

import { corsOriginPolicy } from './cors-origin';

function result(policy: ReturnType<typeof corsOriginPolicy>, origin: string | undefined) {
  return new Promise<boolean | undefined>((resolve, reject) => {
    policy(origin, (error, allow) => {
      if (error) reject(error);
      else resolve(allow);
    });
  });
}

test('CORS policy allows the configured browser origin and non-browser requests', async () => {
  const policy = corsOriginPolicy('https://erp.example.com');
  assert.equal(await result(policy, 'https://erp.example.com'), true);
  assert.equal(await result(policy, undefined), true);
});

test('CORS policy rejects wildcard and other browser origins', async () => {
  const policy = corsOriginPolicy('https://erp.example.com');
  assert.equal(await result(policy, '*'), false);
  assert.equal(await result(policy, 'https://evil.example.com'), false);
});
