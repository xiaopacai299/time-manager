import * as jose from 'jose';
import type { ServerEnv } from '../config/env.js';

export function accessSecretBytes(env: ServerEnv): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}

export async function signAccessToken(
  env: ServerEnv,
  userId: string,
): Promise<string> {
  return new jose.SignJWT({})
    .setSubject(userId)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessSecretBytes(env));
}

export async function verifyAccessToken(
  env: ServerEnv,
  token: string,
): Promise<string> {
  const { payload } = await jose.jwtVerify(token, accessSecretBytes(env));
  const sub = payload.sub;
  if (typeof sub !== 'string' || !sub) {
    throw new Error('missing_sub');
  }
  return sub;
}
