import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { validateProductionConfig } from './production-config';

const testStorageRoot = mkdtempSync(path.join(tmpdir(), 'construction-erp-production-storage-'));
writeFileSync(path.join(testStorageRoot, '.construction-erp-storage-ready'), 'construction-erp-production-storage-v1\n');
after(() => rmSync(testStorageRoot, { recursive: true, force: true }));

const valid = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  WEB_ORIGIN: 'https://erp.example.com',
  DATABASE_URL: 'postgresql://erp:secret@db.example.com:5432/erp?schema=public',
  STORAGE_ROOT: testStorageRoot,
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


test('production config rejects padded production NODE_ENV', () => {
  const env = valid();
  env.NODE_ENV = ' production ';
  assert.throws(
    () => validateProductionConfig(env),
    /NODE_ENV must equal production exactly without surrounding whitespace/,
  );
});


test('production config rejects padded browser origin', () => {
  const env = valid();
  env.WEB_ORIGIN = ' https://erp.example.com ';
  assert.throws(
    () => validateProductionConfig(env),
    /WEB_ORIGIN must not contain surrounding whitespace/,
  );
});

test('production config rejects padded raw runtime values', () => {
  for (const [name, raw] of [
    ['API_HOST', ' 127.0.0.1 '],
    ['API_PORT', '3000 '],
    ['DATABASE_URL', ' postgresql://erp:secret@db.example.com:5432/erp?schema=public'],
    ['STORAGE_ROOT', '/srv/construction-erp/documents '],
  ] as const) {
    const env = valid();
    env[name] = raw;
    assert.throws(() => validateProductionConfig(env), /must not contain surrounding whitespace/);
  }
});

test('production config refuses startup when persistent storage sentinel is missing', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'construction-erp-missing-sentinel-'));
  try {
    const env = valid();
    env.STORAGE_ROOT = root;
    assert.throws(() => validateProductionConfig(env), /storage sentinel is missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production config refuses startup when persistent storage sentinel is invalid', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'construction-erp-invalid-sentinel-'));
  try {
    writeFileSync(path.join(root, '.construction-erp-storage-ready'), 'wrong-storage\n');
    const env = valid();
    env.STORAGE_ROOT = root;
    assert.throws(() => validateProductionConfig(env), /storage sentinel is invalid/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
