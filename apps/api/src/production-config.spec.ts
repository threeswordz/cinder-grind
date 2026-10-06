import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductionConfig } from './production-config';

const valid = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  WEB_ORIGIN: 'https://erp.example.com',
  DATABASE_URL: 'postgresql://erp:secret@db.example.com:5432/erp?schema=public',
  STORAGE_ROOT: '/srv/construction-erp/documents',
  DOCUMENT_MAX_FILE_BYTES: '26214400',
  SESSION_TTL_HOURS: '8',
  LOGIN_RATE_LIMIT_MAX: '10',
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: '15',
});

test('production config accepts a complete HTTPS production contract', () => {
  assert.doesNotThrow(() => validateProductionConfig(valid()));
});

test('non-production environments retain existing local defaults', () => {
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'test' }));
});

test('production config rejects HTTP browser origin', () => {
  const env = valid();
  env.WEB_ORIGIN = 'http://erp.example.com';
  assert.throws(() => validateProductionConfig(env), /WEB_ORIGIN must use HTTPS/);
});

test('production config rejects relative storage root', () => {
  const env = valid();
  env.STORAGE_ROOT = '../../storage';
  assert.throws(() => validateProductionConfig(env), /STORAGE_ROOT must be an absolute path/);
});

test('production config rejects missing database URL', () => {
  const env = valid();
  delete env.DATABASE_URL;
  assert.throws(() => validateProductionConfig(env), /DATABASE_URL is required/);
});

test('production config rejects invalid numeric controls', () => {
  const env = valid();
  env.SESSION_TTL_HOURS = '0';
  assert.throws(() => validateProductionConfig(env), /SESSION_TTL_HOURS must be an integer from 1 to 168/);
});


test('production config rejects numeric values above runtime limits', () => {
  for (const [name, value, maximum] of [
    ['SESSION_TTL_HOURS', '169', 168],
    ['LOGIN_RATE_LIMIT_MAX', '1001', 1000],
    ['LOGIN_RATE_LIMIT_WINDOW_MINUTES', '1441', 1440],
    ['DOCUMENT_MAX_FILE_BYTES', '2000000001', 2_000_000_000],
  ] as const) {
    const env = valid();
    env[name] = value;
    assert.throws(
      () => validateProductionConfig(env),
      new RegExp(`${name} must be an integer from 1 to ${maximum}`),
    );
  }
});

test('production config rejects non-canonical browser origin', () => {
  const env = valid();
  env.WEB_ORIGIN = 'https://erp.example.com/';
  assert.throws(() => validateProductionConfig(env), /must equal its canonical HTTPS origin/);
});
