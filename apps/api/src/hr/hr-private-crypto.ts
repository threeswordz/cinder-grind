import { ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

/** Internal storage primitive, not an authorization decision or a public DTO.
 * Callers must authorize persisted Company/category/action access before use.
 * Every private revision/file has a distinct immutable recordId and version.
 */
export type HrPrivateBinding = {
  companyId: string;
  employeeId: string;
  category: 'identity' | 'bank' | 'document' | 'employment-history';
  recordId: string;
  version: number;
};

type Environment = { HR_PRIVATE_KEYS?: string | undefined; HR_PRIVATE_ACTIVE_KEY_ID?: string | undefined };
type Envelope = { v: 1; k: string; n: string; t: string; c: string };
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CATEGORIES = new Set(['identity', 'bank', 'document', 'employment-history']);
// A cryptographic resource bound, not a replacement for upload/type/field limits.
const MAX_BYTES = 16 * 1024 * 1024;
const SALT = Buffer.from('construction-erp/hr-private/v1', 'utf8');

function unavailable(): ServiceUnavailableException {
  // Deliberately identical for configuration, key, scope, corruption and format
  // failures. Never attach the original exception, plaintext, key or envelope.
  return new ServiceUnavailableException({
    code: 'HR_PRIVATE_UNAVAILABLE', detail: 'Private HR data is unavailable.',
  });
}

function base64(value: unknown, length?: number): Buffer {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_BYTES / 3) * 4) throw unavailable();
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value || (length !== undefined && bytes.length !== length)) {
    bytes.fill(0);
    throw unavailable();
  }
  return bytes;
}

function canonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function bindingBytes(binding: HrPrivateBinding): Buffer {
  if (!binding || !canonicalUuid(binding.companyId) || !canonicalUuid(binding.employeeId) ||
      !canonicalUuid(binding.recordId) || !CATEGORIES.has(binding.category) ||
      !Number.isSafeInteger(binding.version) || binding.version < 1) throw unavailable();
  // Fixed array ordering avoids ambiguous concatenation or property-order AAD.
  return Buffer.from(JSON.stringify([
    'construction-erp/hr-private', 1, binding.companyId, binding.employeeId,
    binding.category, binding.recordId, binding.version,
  ]), 'utf8');
}

function parseEnvelope(serialized: string): Envelope {
  if (typeof serialized !== 'string' || serialized.length > Math.ceil(MAX_BYTES / 3) * 4 + 256) throw unavailable();
  const value: unknown = JSON.parse(serialized);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(',') !== 'c,k,n,t,v' || row.v !== 1 ||
      typeof row.k !== 'string' || !KEY_ID.test(row.k) ||
      typeof row.n !== 'string' || typeof row.t !== 'string' || typeof row.c !== 'string') throw unavailable();
  return row as Envelope;
}

export class HrPrivateCrypto {
  constructor(private readonly environment: () => Environment = () => ({
    HR_PRIVATE_KEYS: process.env.HR_PRIVATE_KEYS, HR_PRIVATE_ACTIVE_KEY_ID: process.env.HR_PRIVATE_ACTIVE_KEY_ID,
  })) {}

  /** Resolve on every operation: removal of a retired key takes effect without
   * preserving old configuration in a process-wide decrypt cache. Empty config
   * is never replaced with a dev/default key. Root keys stay outside the DB.
   */
  private key(purpose: 'encryption' | 'replay', requestedId?: string): { id: string; bytes: Buffer } {
    const environment = this.environment();
    const active = environment.HR_PRIVATE_ACTIVE_KEY_ID;
    if (typeof active !== 'string' || !KEY_ID.test(active) ||
        typeof environment.HR_PRIVATE_KEYS !== 'string' || environment.HR_PRIVATE_KEYS.length > 4096) throw unavailable();
    const value: unknown = JSON.parse(environment.HR_PRIVATE_KEYS);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable();
    const entries = Object.entries(value);
    if (entries.length < 1 || entries.length > 16 || !entries.every(([id]) => KEY_ID.test(id)) ||
        !Object.hasOwn(value, active)) throw unavailable();
    const roots = new Map<string, Buffer>();
    try {
      for (const [id, encoded] of entries) roots.set(id, base64(encoded, 32));
      const id = requestedId ?? active;
      if (!KEY_ID.test(id) || !roots.has(id)) throw unavailable();
      // Separate encryption and replay authentication keys; including the key
      // identifier prevents envelope/key-version relabelling under a shared root.
      return { id, bytes: Buffer.from(hkdfSync('sha256', roots.get(id)!, SALT,
        Buffer.from(`hr-private/${purpose}/${id}/v1`, 'utf8'), 32)) };
    } finally {
      for (const root of roots.values()) root.fill(0);
    }
  }

  seal(plaintext: Buffer, binding: HrPrivateBinding): string {
    let key: Buffer | undefined;
    try {
      if (!Buffer.isBuffer(plaintext) || plaintext.length > MAX_BYTES) throw unavailable();
      const aad = bindingBytes(binding);
      const resolved = this.key('encryption'); key = resolved.bytes;
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const envelope: Envelope = { v: 1, k: resolved.id, n: nonce.toString('base64'),
        t: cipher.getAuthTag().toString('base64'), c: ciphertext.toString('base64') };
      return JSON.stringify(envelope);
    } catch {
      throw unavailable();
    } finally { key?.fill(0); }
  }

  open(serialized: string, binding: HrPrivateBinding): Buffer {
    let key: Buffer | undefined;
    let unauthenticated: Buffer | undefined;
    try {
      const aad = bindingBytes(binding);
      const envelope = parseEnvelope(serialized);
      const nonce = base64(envelope.n, 12), tag = base64(envelope.t, 16);
      const ciphertext = base64(envelope.c);
      if (ciphertext.length > MAX_BYTES) throw unavailable();
      const resolved = this.key('encryption', envelope.k); key = resolved.bytes;
      const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
      decipher.setAAD(aad); decipher.setAuthTag(tag);
      // GCM update returns unauthenticated plaintext. Do not return it until
      // final() verifies the tag, and clear the intermediate on every exit.
      unauthenticated = decipher.update(ciphertext);
      const final = decipher.final();
      return Buffer.concat([unauthenticated, final]);
    } catch {
      throw unavailable();
    } finally { key?.fill(0); unauthenticated?.fill(0); }
  }

  /** A keyed fingerprint avoids a public, brute-forceable hash of identity/bank
   * inputs in replay rows. The caller supplies canonical request bytes and the
   * original keyId for retries after rotation. This does not authorize replay.
   */
  fingerprint(canonicalRequest: Buffer, keyId?: string): { keyId: string; digest: string } {
    let key: Buffer | undefined;
    try {
      if (!Buffer.isBuffer(canonicalRequest) || canonicalRequest.length > MAX_BYTES) throw unavailable();
      const resolved = this.key('replay', keyId); key = resolved.bytes;
      return { keyId: resolved.id,
        digest: createHmac('sha256', key).update(canonicalRequest).digest('hex') };
    } catch {
      throw unavailable();
    } finally { key?.fill(0); }
  }
}
