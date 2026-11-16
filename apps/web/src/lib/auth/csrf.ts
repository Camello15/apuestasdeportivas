import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

const sessionBinding = (request: NextRequest): string =>
  request.cookies.get('refresh_token')?.value ?? request.cookies.get('access_token')?.value ?? 'anonymous';

const signature = (secret: string, binding: string, nonce: string): string =>
  createHmac('sha256', secret).update(`csrf:v1\0${binding}\0${nonce}`).digest('base64url');

export function hasCsrfSecret(secret: string | undefined): secret is string {
  return Boolean(secret && Buffer.byteLength(secret, 'utf8') >= 32);
}

export function createCsrfToken(request: NextRequest, secret: string): string {
  const nonce = randomBytes(32).toString('base64url');
  return `${nonce}.${signature(secret, sessionBinding(request), nonce)}`;
}

export function hasTrustedOrigin(request: NextRequest, expectedOrigin: string): boolean {
  return request.headers.get('origin') === expectedOrigin;
}

export function hasValidCsrfToken(request: NextRequest, secret: string | undefined): boolean {
  if (!hasCsrfSecret(secret)) return false;
  const cookieToken = request.cookies.get('csrf_token')?.value;
  const headerToken = request.headers.get('x-csrf-token');
  if (!cookieToken || !headerToken) return false;
  const cookie = Buffer.from(cookieToken);
  const header = Buffer.from(headerToken);
  if (cookie.length !== header.length || !timingSafeEqual(cookie, header)) return false;

  const [nonce, suppliedSignature, ...extra] = cookieToken.split('.');
  if (extra.length || !nonce || !suppliedSignature || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) return false;
  const expected = Buffer.from(signature(secret, sessionBinding(request), nonce));
  const supplied = Buffer.from(suppliedSignature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
