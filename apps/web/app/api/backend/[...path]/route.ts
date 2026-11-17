import { NextRequest, NextResponse } from 'next/server';
import { createCsrfToken, hasCsrfSecret, hasTrustedFetchSource, hasTrustedOrigin, hasValidCsrfToken } from '../../../../src/lib/auth/csrf';

const publicRegistrationPaths = new Set([
  '/auth/register',
  '/auth/email/verify',
  '/auth/email/resend',
]);
const supportedPostPaths = new Set([...publicRegistrationPaths, '/auth/login', '/auth/session/refresh', '/auth/session/logout', '/auth/password/forgot', '/auth/password/reset', '/auth/totp/setup', '/auth/totp/confirm', '/auth/totp/verify-login', '/auth/totp/recovery/request', '/auth/totp/recovery/complete', '/auth/totp/recovery/setup', '/auth/totp/recovery/confirm', '/authorization/users/list', '/authorization/users/operator/assign', '/authorization/users/operator/remove']);
const isSupportedPostPath = (path: string) => supportedPostPaths.has(path) || /^\/authorization\/users\/[0-9a-f-]{36}\/operator\/(assign|remove)$/i.test(path) || /^\/auth\/admin\/sessions\/[0-9a-f-]{36}\/revoke$/i.test(path);

function apiBaseUrl(): URL {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error('TLS certificate verification cannot be disabled');
  }
  const value = process.env.API_BASE_URL;
  if (!value) throw new Error('API_BASE_URL is not configured');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('BFF to API traffic must use an HTTPS origin with certificate verification enabled');
  }
  return url;
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const expectedOrigin = process.env.WEB_ORIGIN;
  if (!expectedOrigin || !hasTrustedOrigin(request, expectedOrigin)) {
    return NextResponse.json({ code: 'REQUEST_REJECTED', message: 'La solicitud fue rechazada.' }, { status: 403 });
  }

  const { path } = await context.params;
  const endpoint = `/${path.join('/')}`;
  if (!isSupportedPostPath(endpoint)) {
    return NextResponse.json({ code: 'REQUEST_REJECTED', message: 'La ruta solicitada no está disponible.' }, { status: 404 });
  }

  const hasSessionCookie = Boolean(request.cookies.get('access_token') || request.cookies.get('refresh_token'));
  if (hasSessionCookie && !hasValidCsrfToken(request, process.env.CSRF_SECRET)) {
    return NextResponse.json({ code: 'CSRF_REJECTED', message: 'La solicitud fue rechazada.' }, { status: 403 });
  }

  let target: URL;
  try {
    target = new URL(endpoint, apiBaseUrl());
  } catch {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible.' }, { status: 503 });
  }

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json',
        ...(request.headers.get('cookie') ? { cookie: request.headers.get('cookie')! } : {}),
        ...(request.headers.get('user-agent') ? { 'user-agent': request.headers.get('user-agent')! } : {}),
      },
      body: await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
    });
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    headers.set('cache-control', 'no-store');
    for (const setCookie of upstream.headers.getSetCookie()) headers.append('set-cookie', setCookie);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible.' }, { status: 503 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.join('/') !== 'auth/csrf' || !hasTrustedFetchSource(request, process.env.WEB_ORIGIN)) {
    return NextResponse.json({ code: 'REQUEST_REJECTED', message: 'La solicitud fue rechazada.' }, { status: 403 });
  }
  if (!hasCsrfSecret(process.env.CSRF_SECRET)) {
    return NextResponse.json({ code: 'SERVICE_UNAVAILABLE', message: 'El servicio no está disponible.' }, { status: 503 });
  }
  const token = createCsrfToken(request, process.env.CSRF_SECRET);
  const response = NextResponse.json({ token });
  response.cookies.set('csrf_token', token, {
    httpOnly: false, secure: true, sameSite: 'lax', path: '/api/backend',
  });
  response.headers.set('cache-control', 'no-store');
  return response;
}
