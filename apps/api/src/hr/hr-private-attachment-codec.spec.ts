import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { DocumentPolicyService } from '../documents/document-policy.service';
import { HrPrivateCrypto } from './hr-private-crypto';
import {
  HR_PRIVATE_ATTACHMENT_MAX_BYTES, sealHrPrivateAttachment, openHrPrivateAttachment,
} from './hr-private-attachment-codec';

const scope = () => ({
  companyId: randomUUID(), employeeId: randomUUID(),
  recordId: randomUUID(), version: 1,
});
const upload = () => ({
  originalname: 'private-employee-evidence.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('SYNTHETIC_CONFIDENTIAL_EMPLOYEE_CONTENT_12345'),
});
const fixture = () => {
  const keys: Record<string,string> = { key1: randomBytes(32).toString('base64') };
  const env = { HR_PRIVATE_KEYS: JSON.stringify(keys), HR_PRIVATE_ACTIVE_KEY_ID: 'key1' };
  return { env, keys, crypto: new HrPrivateCrypto(() => env), policy: new DocumentPolicyService() };
};
function denied(callback: () => unknown) {
  assert.throws(callback, (error: unknown) => {
    const value = error as { getResponse?: () => unknown };
    const message = value.getResponse?.() as { code?: string; detail?: string } | undefined;
    return message?.code === 'HR_PRIVATE_UNAVAILABLE' &&
      message?.detail === 'Private HR data is unavailable.';
  });
}

test('encrypts both filename metadata and bytes; canonical generic fields contain no plaintext',()=>{
  const f=fixture(), id=scope(), original=upload();
  const result=sealHrPrivateAttachment(f.crypto,f.policy,id,original);
  assert.equal(result.genericFileName,'hr-private.enc');
  assert.equal(result.genericMimeType,'application/octet-stream');
  assert.equal(result.genericSizeBytes,result.encryptedBytes.length);
  assert.match(result.encryptedChecksum,/^[0-9a-f]{64}$/);
  const encoded=result.encryptedBytes.toString('utf8');
  for(const sensitive of [original.originalname,original.buffer.toString(), 'SYNTHETIC_CONFIDENTIAL'])
    assert.equal(encoded.includes(sensitive)||result.encryptedMetadata.includes(sensitive),false);
  const opened=openHrPrivateAttachment(f.crypto,f.policy,id,result.encryptedBytes,result.encryptedMetadata);
  try {
    assert.equal(opened.originalname,original.originalname);
    assert.equal(opened.mimetype,original.mimetype);
    assert.deepEqual(opened.bytes,original.buffer);
  } finally { opened.bytes.fill(0);original.buffer.fill(0); }
});

test('unique nonce and bound identity prevent cross-Company, employee, document and version swaps',()=>{
  const f=fixture(), id=scope(), original=upload();
  const first=sealHrPrivateAttachment(f.crypto,f.policy,id,original);
  const second=sealHrPrivateAttachment(f.crypto,f.policy,id,original);
  assert.notDeepEqual(first.encryptedBytes,second.encryptedBytes);
  assert.notEqual(first.encryptedMetadata,second.encryptedMetadata);
  for(const altered of [
    { ...id, companyId: randomUUID() },
    { ...id, employeeId: randomUUID() },
    { ...id, recordId: randomUUID() },
    { ...id, version: 2 },
  ]) denied(()=>openHrPrivateAttachment(f.crypto,f.policy,altered,first.encryptedBytes,first.encryptedMetadata));
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,first.encryptedBytes,second.encryptedMetadata.replace('"v":1','"v":2')));
  original.buffer.fill(0);
});

test('tampering, truncated ciphertext and removed/wrong historical keys deny without leaking crypto internals',()=>{
  const f=fixture(), id=scope(), original=upload();
  const first=sealHrPrivateAttachment(f.crypto,f.policy,id,original);
  const corrupt=Buffer.from(first.encryptedBytes);
  corrupt.writeUInt8(corrupt.readUInt8(corrupt.length - 8) ^ 1, corrupt.length - 8);
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,corrupt,first.encryptedMetadata));
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,Buffer.from('invalid'),first.encryptedMetadata));
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,first.encryptedBytes,'{}'));
  f.keys.key2=randomBytes(32).toString('base64');
  f.env.HR_PRIVATE_KEYS=JSON.stringify(f.keys);
  f.env.HR_PRIVATE_ACTIVE_KEY_ID='key2';
  const rotated=sealHrPrivateAttachment(f.crypto,f.policy,id,original);
  const old=openHrPrivateAttachment(f.crypto,f.policy,id,first.encryptedBytes,first.encryptedMetadata);
  old.bytes.fill(0);
  const now=openHrPrivateAttachment(f.crypto,f.policy,id,rotated.encryptedBytes,rotated.encryptedMetadata);
  now.bytes.fill(0);
  delete f.keys.key1;
  f.env.HR_PRIVATE_KEYS=JSON.stringify(f.keys);
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,first.encryptedBytes,first.encryptedMetadata));
  original.buffer.fill(0);
});

test('metadata authenticates the exact ciphertext; same-scope envelopes cannot substitute for each other',()=>{
  const f=fixture(), id=scope(), original=upload();
  const first=sealHrPrivateAttachment(f.crypto,f.policy,id,original);
  const alternate={ ...upload(), buffer: Buffer.from('SYNTHETIC_CONFIDENTIAL_ALTERNATE_CONTENT') };
  const second=sealHrPrivateAttachment(f.crypto,f.policy,id,alternate);
  assert.notEqual(first.encryptedChecksum,second.encryptedChecksum);
  // Both metadata and file envelopes are valid AES-GCM records for the same
  // Company/employee/document/version, but only their original pair is valid.
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,
    Buffer.from(first.encryptedMetadata,'utf8'),first.encryptedMetadata));
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,
    first.encryptedBytes,first.encryptedBytes.toString('utf8')));
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,
    first.encryptedBytes,second.encryptedMetadata));
  denied(()=>openHrPrivateAttachment(f.crypto,f.policy,id,
    second.encryptedBytes,first.encryptedMetadata));
  const opened=openHrPrivateAttachment(f.crypto,f.policy,id,second.encryptedBytes,second.encryptedMetadata);
  try { assert.deepEqual(opened.bytes,alternate.buffer); }
  finally { opened.bytes.fill(0); original.buffer.fill(0); alternate.buffer.fill(0); }
});

test('rejects empty, oversized, unsafe-name and unsupported MIME files before ciphertext creation',()=>{
  const f=fixture(), id=scope();
  for(const invalidFile of [
    { ...upload(), buffer: Buffer.alloc(0) },
    { ...upload(), buffer: Buffer.alloc(HR_PRIVATE_ATTACHMENT_MAX_BYTES+1) },
    { ...upload(), originalname: '../identity.pdf' },
    { ...upload(), originalname: 'staff\\bank.pdf' },
    { ...upload(), mimetype: 'application/x-executable' },
  ]) assert.throws(()=>sealHrPrivateAttachment(f.crypto,f.policy,id,invalidFile));
});
