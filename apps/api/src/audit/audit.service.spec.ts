import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeAuditValue } from './audit.service';

test('audit sanitizer redacts nested credentials and tokens', () => {
  const sanitized = sanitizeAuditValue({
    email: 'user@example.com',
    passwordHash: 'do-not-store',
    nested: {
      sessionToken: 'do-not-store',
      safe: 'value',
    },
    items: [{ apiSecret: 'do-not-store', quantity: 2 }],
  });

  assert.deepEqual(sanitized, {
    email: 'user@example.com',
    passwordHash: '[REDACTED]',
    nested: {
      sessionToken: '[REDACTED]',
      safe: 'value',
    },
    items: [{ apiSecret: '[REDACTED]', quantity: 2 }],
  });
});
