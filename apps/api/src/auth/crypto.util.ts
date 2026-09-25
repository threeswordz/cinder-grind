import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function randomOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function safeHashEquals(expectedHex: string, candidateValue: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex');
  const candidate = Buffer.from(sha256Hex(candidateValue), 'hex');

  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}
