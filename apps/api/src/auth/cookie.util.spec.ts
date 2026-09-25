import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildClearedSessionCookie,
  buildSessionCookie,
  readSessionCookie,
} from './cookie.util';

test('session cookie uses secure browser attributes', () => {
  const cookie = buildSessionCookie('abc_DEF-12345678901234567890', 3600, true);

  assert.match(cookie, /^erp_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=3600/);
  assert.match(cookie, /Secure/);
});

test('session cookie parser accepts only safe session values', () => {
  assert.equal(
    readSessionCookie(
      'theme=dark; erp_session=abc_DEF-12345678901234567890; other=value',
    ),
    'abc_DEF-12345678901234567890',
  );
  assert.equal(readSessionCookie('erp_session=unsafe%0d%0aheader'), null);
});

test('cleared session cookie expires immediately', () => {
  const cookie = buildClearedSessionCookie(false);
  assert.match(cookie, /^erp_session=;/);
  assert.match(cookie, /Max-Age=0/);
  assert.doesNotMatch(cookie, /Secure/);
});
