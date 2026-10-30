import { createHash } from 'node:crypto';
import { UnprocessableEntityException, ServiceUnavailableException } from '@nestjs/common';
import { DocumentPolicyService } from '../documents/document-policy.service';
import { HrPrivateBinding, HrPrivateCrypto } from './hr-private-crypto';

/**
 * Internal encrypted attachment payload, not a read grant, upload endpoint or
 * canonical Document database record. The caller must independently authorize
 * target Company/employee + documents.manage/view inside its transaction.
 */
export type HrAttachmentScope = Omit<HrPrivateBinding, 'category'>;
export type HrAttachmentFile = { originalname: string; mimetype: string; buffer: Buffer };
export type HrSealedAttachment = {
  encryptedBytes: Buffer;
  encryptedMetadata: string;
  genericFileName: 'hr-private.enc';
  genericMimeType: 'application/octet-stream';
  genericSizeBytes: number;
  encryptedChecksum: string;
};
export type HrOpenedAttachment = { originalname: string; mimetype: string; bytes: Buffer };

export const HR_PRIVATE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

const invalid = (): never => {
  throw new UnprocessableEntityException({
    code: 'HR_ATTACHMENT_INVALID',
    detail: 'Private HR attachment must meet the approved size, type and filename limits.',
  });
};
const unavailable = (): never => {
  throw new ServiceUnavailableException({
    code: 'HR_PRIVATE_UNAVAILABLE', detail: 'Private HR data is unavailable.',
  });
};
const binding = (scope: HrAttachmentScope): HrPrivateBinding => ({ ...scope, category: 'document' });

/** Only ciphertext and a fixed generic filename may reach canonical storage. */
export function sealHrPrivateAttachment(
  crypto: HrPrivateCrypto, policy: DocumentPolicyService,
  scope: HrAttachmentScope, file: HrAttachmentFile,
): HrSealedAttachment {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length ||
      file.buffer.length > HR_PRIVATE_ATTACHMENT_MAX_BYTES) invalid();
  // Reuse canonical file type/filename restrictions, never widen the general
  // document upload policy to accommodate encrypted payloads.
  const normalized = policy.validate({
    originalname: file.originalname, mimetype: file.mimetype,
    size: file.buffer.length, buffer: file.buffer,
  });
  const aad = binding(scope);
  // The encrypted metadata authenticates the exact ciphertext digest, so
  // separately valid envelopes cannot be swapped even for the same record.
  const encryptedBytes = Buffer.from(crypto.seal(file.buffer, aad), 'utf8');
  const encryptedDigest = createHash('sha256').update(encryptedBytes).digest('hex');
  const metadata = Buffer.from(JSON.stringify({
    originalname: normalized.fileName, mimetype: normalized.mimeType,
    size: file.buffer.length, encryptedDigest,
  }), 'utf8');
  try {
    // Each AES-GCM seal obtains a fresh nonce, even under the same immutable
    // Company/employee/document ID/version binding. No plaintext temp file.
    const encryptedMetadata = crypto.seal(metadata, aad);
    return {
      encryptedMetadata, encryptedBytes, genericFileName: 'hr-private.enc',
      genericMimeType: 'application/octet-stream',
      genericSizeBytes: encryptedBytes.length,
      encryptedChecksum: encryptedDigest,
    };
  } finally { metadata.fill(0); }
}

/** Only a previously authorized dedicated HR route may call this method. */
export function openHrPrivateAttachment(
  crypto: HrPrivateCrypto, policy: DocumentPolicyService,
  scope: HrAttachmentScope, encryptedBytes: Buffer, encryptedMetadata: string,
): HrOpenedAttachment {
  if (!Buffer.isBuffer(encryptedBytes) || !encryptedBytes.length ||
      encryptedBytes.length > HR_PRIVATE_ATTACHMENT_MAX_BYTES * 2 ||
      typeof encryptedMetadata !== 'string') unavailable();
  const aad = binding(scope);
  let metadata: Buffer | undefined;
  let plaintext: Buffer | undefined;
  try {
    metadata = crypto.open(encryptedMetadata, aad);
    const parsed: unknown = JSON.parse(metadata.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) unavailable();
    const row = parsed as Record<string, unknown>;
    const originalname: string = typeof row.originalname === 'string' ? row.originalname : unavailable();
    const mimetype: string = typeof row.mimetype === 'string' ? row.mimetype : unavailable();
    const size = row.size, encryptedDigest = row.encryptedDigest;
    if (Object.keys(row).sort().join(',') !== 'encryptedDigest,mimetype,originalname,size' ||
        typeof size !== 'number' || !Number.isSafeInteger(size) ||
        size < 1 || size > HR_PRIVATE_ATTACHMENT_MAX_BYTES ||
        typeof encryptedDigest !== 'string' || !/^[0-9a-f]{64}$/.test(encryptedDigest)) unavailable();
    // Reject a valid but substituted envelope before decrypting the file.
    if (createHash('sha256').update(encryptedBytes).digest('hex') !== encryptedDigest) unavailable();
    plaintext = crypto.open(encryptedBytes.toString('utf8'), aad);
    if (plaintext.length !== size) unavailable();
    const normalized = policy.validate({
      originalname, mimetype,
      size: plaintext.length, buffer: plaintext,
    });
    return { originalname: normalized.fileName, mimetype: normalized.mimeType, bytes: plaintext };
  } catch {
    plaintext?.fill(0);
    return unavailable();
  } finally { metadata?.fill(0); }
}
