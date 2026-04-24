import { createHash, randomBytes } from 'node:crypto';

export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function newOpaqueRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}
