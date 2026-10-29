import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import test from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { HrPrivateBinding, HrPrivateCrypto } from './hr-private-crypto';

const root = () => randomBytes(32).toString('base64');
const binding = (): HrPrivateBinding => ({ companyId: randomUUID(), employeeId: randomUUID(),
  recordId: randomUUID(), category: 'identity', version: 1 });
function fixture() {
  let environment: { HR_PRIVATE_KEYS?: string; HR_PRIVATE_ACTIVE_KEY_ID?: string } = {
    HR_PRIVATE_KEYS: JSON.stringify({ k1: root() }), HR_PRIVATE_ACTIVE_KEY_ID: 'k1',
  };
  const crypto = new HrPrivateCrypto(() => environment);
  return { crypto, get environment() { return environment; }, set environment(value) { environment = value; } };
}
function denied(action: () => unknown) {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.deepEqual(error.getResponse(), { code: 'HR_PRIVATE_UNAVAILABLE', detail: 'Private HR data is unavailable.' });
    assert.equal(error.cause, undefined);
    return true;
  });
}

test('private bytes round-trip exactly; same input produces independently authenticated envelopes', () => {
  const f = fixture(), scope = binding();
  const privateBytes = Buffer.from('Synthetic identity\0บัญชีธนาคาร\n銀行帳戶 / sensitive reason', 'utf8');
  const first = f.crypto.seal(privateBytes, scope), second = f.crypto.seal(privateBytes, scope);
  assert.notEqual(first, second);
  assert.notEqual(JSON.parse(first).n, JSON.parse(second).n);
  assert.deepEqual(f.crypto.open(first, scope), privateBytes);
  assert.deepEqual(f.crypto.open(second, scope), privateBytes);
  for (const text of ['Synthetic identity', 'บัญชีธนาคาร', '銀行帳戶', 'sensitive reason', privateBytes.toString('base64')]) {
    assert.equal(first.includes(text), false);
  }
  assert.equal(first.includes(f.environment.HR_PRIVATE_KEYS!), false);
  const empty = f.crypto.seal(Buffer.alloc(0), scope);
  assert.deepEqual(f.crypto.open(empty, scope), Buffer.alloc(0));
});

test('Company, employee, category, record identity and revision are authenticated independently', () => {
  const f = fixture(), scope = binding(), encrypted = f.crypto.seal(Buffer.from('private'), scope);
  const substitutions: Partial<HrPrivateBinding>[] = [
    { companyId: randomUUID() }, { employeeId: randomUUID() }, { category: 'bank' },
    { category: 'document' }, { category: 'employment-history' }, { recordId: randomUUID() }, { version: 2 },
  ];
  for (const change of substitutions) denied(() => f.crypto.open(encrypted, { ...scope, ...change }));
  for (const category of ['identity', 'bank', 'document', 'employment-history'] as const) {
    const target = { ...scope, category };
    assert.equal(f.crypto.open(f.crypto.seal(Buffer.from(category), target), target).toString(), category);
  }
});

test('ciphertext, nonce, authentication tag and envelope key relabelling fail without returning plaintext', () => {
  const f = fixture(), scope = binding(), encrypted = f.crypto.seal(Buffer.from('do not disclose this value'), scope);
  for (const field of ['n', 't', 'c']) {
    const envelope = JSON.parse(encrypted);
    const bytes = Buffer.from(envelope[field], 'base64'); bytes[0] = bytes[0]! ^ 1;
    envelope[field] = bytes.toString('base64');
    denied(() => f.crypto.open(JSON.stringify(envelope), scope));
  }
  // Same underlying root under another identifier cannot relabel an envelope.
  const roots = JSON.parse(f.environment.HR_PRIVATE_KEYS!); roots.k2 = roots.k1;
  f.environment.HR_PRIVATE_KEYS = JSON.stringify(roots);
  denied(() => f.crypto.open(JSON.stringify({ ...JSON.parse(encrypted), k: 'k2' }), scope));
});

test('rotation seals with the active key; retained old keys decrypt history and authenticate old retries', () => {
  const f = fixture(), scope = binding(), bytes = Buffer.from('historical private record');
  const old = f.crypto.seal(bytes, scope), replay = f.crypto.fingerprint(bytes);
  const roots = JSON.parse(f.environment.HR_PRIVATE_KEYS!); roots.k2 = root();
  f.environment = { HR_PRIVATE_KEYS: JSON.stringify(roots), HR_PRIVATE_ACTIVE_KEY_ID: 'k2' };
  assert.equal(JSON.parse(f.crypto.seal(bytes, scope)).k, 'k2');
  assert.deepEqual(f.crypto.open(old, scope), bytes);
  assert.deepEqual(f.crypto.fingerprint(bytes, replay.keyId), replay);
  assert.notEqual(f.crypto.fingerprint(bytes).digest, replay.digest);
  delete roots.k1; f.environment.HR_PRIVATE_KEYS = JSON.stringify(roots);
  denied(() => f.crypto.open(old, scope));
  denied(() => f.crypto.fingerprint(bytes, 'k1'));
});

test('absent, invalid, wrong and removed key material has one non-sensitive failure shape', () => {
  const f = fixture(), scope = binding(), bytes = Buffer.from('sensitive secret');
  const encrypted = f.crypto.seal(bytes, scope);
  const cases = [ {}, { HR_PRIVATE_KEYS: '{}', HR_PRIVATE_ACTIVE_KEY_ID: 'k1' },
    { HR_PRIVATE_KEYS: '{bad JSON', HR_PRIVATE_ACTIVE_KEY_ID: 'k1' },
    { HR_PRIVATE_KEYS: '[]', HR_PRIVATE_ACTIVE_KEY_ID: 'k1' },
    { HR_PRIVATE_KEYS: JSON.stringify({ k1: 'too-short' }), HR_PRIVATE_ACTIVE_KEY_ID: 'k1' },
    { HR_PRIVATE_KEYS: JSON.stringify({ k1: root().replace(/=$/, '') }), HR_PRIVATE_ACTIVE_KEY_ID: 'k1' },
    { HR_PRIVATE_KEYS: JSON.stringify({ k1: root() }), HR_PRIVATE_ACTIVE_KEY_ID: '../key' },
    { HR_PRIVATE_KEYS: JSON.stringify({ k1: root(), bad: 'invalid inactive key' }), HR_PRIVATE_ACTIVE_KEY_ID: 'k1' },
    { HR_PRIVATE_KEYS: JSON.stringify(Object.fromEntries(Array.from({ length: 17 }, (_, i) => ['k' + i, root()]))), HR_PRIVATE_ACTIVE_KEY_ID: 'k1' },
  ];
  for (const environment of cases) {
    f.environment = environment;
    denied(() => f.crypto.seal(bytes, scope)); denied(() => f.crypto.open(encrypted, scope));
    denied(() => f.crypto.fingerprint(bytes));
  }
  f.environment = { HR_PRIVATE_KEYS: JSON.stringify({ k1: root() }), HR_PRIVATE_ACTIVE_KEY_ID: 'k1' };
  denied(() => f.crypto.open(encrypted, scope));
});

test('malformed envelope and noncanonical encodings fail safely', () => {
  const f = fixture(), scope = binding(), encrypted = f.crypto.seal(Buffer.from('private'), scope), envelope = JSON.parse(encrypted);
  for (const input of ['{', 'null', '[]', '{}', '"plaintext"',
    JSON.stringify({ ...envelope, v: 2 }), JSON.stringify({ ...envelope, plaintext: 'injected' }),
    JSON.stringify({ ...envelope, n: Buffer.alloc(8).toString('base64') }),
    JSON.stringify({ ...envelope, t: Buffer.alloc(8).toString('base64') }),
    JSON.stringify({ ...envelope, c: envelope.c + '\n' }),
    JSON.stringify({ ...envelope, k: '../secret' }),
    JSON.stringify({ ...envelope, c: 123 }),
  ]) denied(() => f.crypto.open(input, scope));
});

test('invalid identities, revisions, categories and oversized plaintext cannot create an unbound record', () => {
  const f = fixture(), scope = binding();
  for (const patch of [{ companyId: '' }, { employeeId: '../private' }, { recordId: 'not-a-uuid' },
    { version: 0 }, { version: -1 }, { version: 1.5 }, { version: Number.MAX_SAFE_INTEGER + 1 },
    { category: 'payroll' }, { companyId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }, { companyId: [scope.companyId] }]) {
    denied(() => f.crypto.seal(Buffer.from('private'), { ...scope, ...patch } as HrPrivateBinding));
  }
  denied(() => f.crypto.seal(Buffer.alloc(16 * 1024 * 1024 + 1), scope));
  denied(() => f.crypto.fingerprint(Buffer.alloc(16 * 1024 * 1024 + 1)));
});

test('replay fingerprints are deterministic only for the same key and exact canonical bytes', () => {
  const f = fixture(), bytes = Buffer.from('{"employee":"synthetic","identity":"123456789"}');
  const first = f.crypto.fingerprint(bytes);
  assert.deepEqual(f.crypto.fingerprint(bytes), first);
  assert.notEqual(f.crypto.fingerprint(Buffer.concat([bytes, Buffer.from(' ')] )).digest, first.digest);
  assert.notEqual(first.digest, createHash('sha256').update(bytes).digest('hex'));
  assert.notEqual(fixture().crypto.fingerprint(bytes).digest, first.digest);
  assert.match(first.digest, /^[0-9a-f]{64}$/);
});
