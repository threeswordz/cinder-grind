import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';

import { LoginRateLimitService } from './login-rate-limit.service';

test('login rate limiter blocks attempts above the configured baseline', () => {
  const limiter = new LoginRateLimitService();
  const key = '127.0.0.1';

  for (let index = 0; index < 10; index += 1) {
    assert.doesNotThrow(() => limiter.consume(key));
  }

  assert.throws(
    () => limiter.consume(key),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 429,
  );

  limiter.reset(key);
  assert.doesNotThrow(() => limiter.consume(key));
});
