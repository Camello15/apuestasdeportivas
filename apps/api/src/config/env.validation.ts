import { createPrivateKey, createPublicKey } from 'node:crypto';

type Environment = Record<string, string | undefined>;

const required = (env: Environment, key: string): string => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export function validateEnvironment(env: Environment): Environment {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error('TLS certificate verification cannot be disabled');
  }
  const databaseUrl = required(env, 'DATABASE_URL');
  const redisUrl = required(env, 'REDIS_URL');
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must use PostgreSQL');
  }
  if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
    throw new Error('REDIS_URL must use Redis');
  }
  required(env, 'WEB_ORIGIN');

  if (env.TRUST_PROXY_HOPS !== undefined) {
    const hops = Number(env.TRUST_PROXY_HOPS);
    if (!/^(0|[1-9]\d*)$/.test(env.TRUST_PROXY_HOPS) || !Number.isSafeInteger(hops) || hops > 5) {
      throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5');
    }
  }

  const apiOrigin = required(env, 'API_BASE_URL');
  let parsedApiOrigin: URL;
  try {
    parsedApiOrigin = new URL(apiOrigin);
  } catch {
    throw new Error('API_BASE_URL must be a valid HTTPS URL');
  }
  if (parsedApiOrigin.protocol !== 'https:') {
    throw new Error('API_BASE_URL must use HTTPS; certificate verification remains enabled');
  }
  if (parsedApiOrigin.username || parsedApiOrigin.password || parsedApiOrigin.search || parsedApiOrigin.hash) {
    throw new Error('API_BASE_URL must be an HTTPS origin without credentials, query, or fragment');
  }

  const configuredWebOrigin = required(env, 'WEB_ORIGIN');
  const webOrigin = new URL(configuredWebOrigin);
  if (webOrigin.origin !== configuredWebOrigin.replace(/\/$/, '') || webOrigin.username || webOrigin.password || webOrigin.search || webOrigin.hash) {
    throw new Error('WEB_ORIGIN must contain only an origin');
  }
  if (webOrigin.protocol !== 'https:' && webOrigin.hostname !== 'localhost') {
    throw new Error('WEB_ORIGIN must use HTTPS outside localhost');
  }

  const privateKey = env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const publicKey = env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');
  const hasJwtKey = Boolean(privateKey || publicKey);
  if (hasJwtKey) {
    if (!privateKey || !publicKey || !env.JWT_ISSUER || !env.JWT_AUDIENCE || !env.JWT_KEY_ID) {
      throw new Error('JWT keys, key id, issuer, and audience must be configured together');
    }
    if (!env.REFRESH_TOKEN_PEPPER || Buffer.byteLength(env.REFRESH_TOKEN_PEPPER) < 32) {
      throw new Error('REFRESH_TOKEN_PEPPER must contain at least 32 bytes when JWT sessions are configured');
    }
    try {
      if (createPrivateKey(privateKey).asymmetricKeyType !== 'rsa' || createPublicKey(publicKey).asymmetricKeyType !== 'rsa') {
        throw new Error('not rsa');
      }
    } catch {
      throw new Error('JWT keys must be valid RSA PEM keys');
    }
  }
  if (env.JWT_PUBLIC_KEYS) {
    try {
      const keys = JSON.parse(env.JWT_PUBLIC_KEYS) as Record<string, unknown>;
      if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('invalid keyring');
      for (const [keyId, pem] of Object.entries(keys)) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyId) || typeof pem !== 'string' || createPublicKey(pem.replace(/\\n/g, '\n')).asymmetricKeyType !== 'rsa') throw new Error('invalid key');
      }
    } catch { throw new Error('JWT_PUBLIC_KEYS must be a JSON map of key ids to RSA PEM public keys'); }
  }

  if (env.REFRESH_TOKEN_PEPPER && Buffer.byteLength(env.REFRESH_TOKEN_PEPPER) < 32) {
    throw new Error('REFRESH_TOKEN_PEPPER must contain at least 32 bytes');
  }

  if (env.TOTP_ENCRYPTION_KEY) {
    const key = Buffer.from(env.TOTP_ENCRYPTION_KEY, 'base64');
    if (key.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must decode to 32 bytes');
  }
  if (env.TOTP_ENCRYPTION_KEYS) {
    try {
      const keys = JSON.parse(env.TOTP_ENCRYPTION_KEYS) as Record<string, unknown>;
      if (!keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('invalid keyring');
      for (const [version, encoded] of Object.entries(keys)) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(version) || typeof encoded !== 'string' || Buffer.from(encoded, 'base64').length !== 32) throw new Error('invalid key');
      }
    } catch { throw new Error('TOTP_ENCRYPTION_KEYS must be a JSON map of key versions to 32-byte Base64 keys'); }
  }
  if ((env.TOTP_ENCRYPTION_KEY || env.TOTP_ENCRYPTION_KEYS) && !env.TOTP_KEY_VERSION) {
    throw new Error('TOTP_KEY_VERSION is required when TOTP encryption keys are configured');
  }

  if (env.CAPTCHA_PROVIDER && env.CAPTCHA_PROVIDER !== 'turnstile') {
    throw new Error('CAPTCHA_PROVIDER must be turnstile');
  }
  if (env.CAPTCHA_SECRET_KEY && !env.CAPTCHA_EXPECTED_HOSTNAME) {
    throw new Error('CAPTCHA_EXPECTED_HOSTNAME is required when CAPTCHA is configured');
  }
  if (env.SMTP_SECURE && env.SMTP_SECURE !== 'true' && env.SMTP_SECURE !== 'false') {
    throw new Error('SMTP_SECURE must be true or false');
  }

  const hibpTimeoutMs = Number(env.HIBP_TIMEOUT_MS ?? '3000');
  const hibpMaxRetries = Number(env.HIBP_MAX_RETRIES ?? '1');
  if (hibpTimeoutMs !== 3000 || hibpMaxRetries !== 1) {
    throw new Error('HIBP_TIMEOUT_MS must be 3000 and HIBP_MAX_RETRIES must be 1');
  }

  const emailPort = env.SMTP_PORT ? Number(env.SMTP_PORT) : undefined;
  if (emailPort !== undefined && (!Number.isInteger(emailPort) || emailPort < 1 || emailPort > 65535)) {
    throw new Error('SMTP_PORT must be a valid TCP port');
  }

  return env;
}
