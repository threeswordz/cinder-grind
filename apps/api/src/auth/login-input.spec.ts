import assert from 'node:assert/strict';
import test from 'node:test';
import { UnprocessableEntityException } from '@nestjs/common';

import { parseLoginInput } from './login-input';

test('login input accepts a valid email and password', () => {
  assert.deepEqual(
    parseLoginInput({
      email: 'user@example.com',
      password: 'example-password',
    }),
    {
      email: 'user@example.com',
      password: 'example-password',
    },
  );
});

test('login input rejects malformed fields with validation error', () => {
  assert.throws(
    () => parseLoginInput({ email: 'invalid', password: '' }),
    (error: unknown) => error instanceof UnprocessableEntityException,
  );
});
