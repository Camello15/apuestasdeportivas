const SAFE_CODES = new Set([
  'AUTHENTICATION_FAILED', 'UNAUTHENTICATED', 'SESSION_INVALID', 'AUTHORIZATION_DENIED',
  'INVALID_REQUEST', 'PASSWORD_POLICY_REJECTED', 'EMAIL_VERIFICATION_INVALID',
  'EMAIL_VERIFICATION_UNAVAILABLE', 'REGISTRATION_REJECTED', 'REQUEST_REJECTED',
  'TOTP_CODE_INVALID', 'TOTP_SETUP_EXPIRED', 'TOTP_RECOVERY_REJECTED',
  'SERVICE_UNAVAILABLE', 'AUTH_LIMITER_UNAVAILABLE', 'AUTH_CHALLENGE_UNAVAILABLE',
  'EMAIL_UNAVAILABLE', 'TOTP_UNAVAILABLE', 'PASSWORD_RESET_REJECTED',
]);

export function publicAuthErrorCode(status: number, response: unknown): string {
  const raw = typeof response === 'object' && response !== null && 'code' in response
    ? String((response as { code: unknown }).code) : '';
  if (status === 401) return raw === 'SESSION_INVALID' ? raw : 'AUTHENTICATION_FAILED';
  if (status === 403) return raw === 'AUTHORIZATION_DENIED' ? raw : 'REQUEST_REJECTED';
  if (status >= 500) return 'SERVICE_UNAVAILABLE';
  if (SAFE_CODES.has(raw)) return raw;
  return status === 400 ? 'INVALID_REQUEST' : 'REQUEST_REJECTED';
}
