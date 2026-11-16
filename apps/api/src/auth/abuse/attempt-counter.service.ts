import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';

const RECORD_FAILURE = `
local lockTtl = redis.call('PTTL', KEYS[2])
if lockTtl > 0 or lockTtl == -1 then return {0, lockTtl} end
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local threshold = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - windowMs)
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], windowMs)
local count = redis.call('ZCARD', KEYS[1])
if count >= threshold then
  redis.call('SET', KEYS[2], '1', 'PX', tonumber(ARGV[5]))
  return {0, tonumber(ARGV[5]), count}
end
return {1, 0, count}
`;

const CHECK_IP = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maximum = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - windowMs)
local count = redis.call('ZCARD', KEYS[1])
if count >= maximum then return {0, count} end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], windowMs)
return {1, count + 1}
`;

const CHECK_EMAIL_RESEND = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local accountLimit = tonumber(ARGV[3])
local ipLimit = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - windowMs)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - windowMs)
local accountCount = redis.call('ZCARD', KEYS[1])
local ipCount = redis.call('ZCARD', KEYS[2])
if accountCount >= accountLimit or ipCount >= ipLimit then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[5])
redis.call('ZADD', KEYS[2], now, ARGV[5])
redis.call('PEXPIRE', KEYS[1], windowMs)
redis.call('PEXPIRE', KEYS[2], windowMs)
return 1
`;

const RESET_COUNTER = `redis.call('DEL', KEYS[1], KEYS[2]); return 1`;

@Injectable()
export class AttemptCounterService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? '', { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async checkIpAttempt(ip: string): Promise<boolean> {
    const key = this.keySubject(ip);
    const result = await this.runScript(CHECK_IP, `auth:ip:${key}`, null, 15 * 60_000, 20);
    return Number(result[0]) === 1;
  }

  async checkEmailVerificationResend(accountKey: string, ip: string): Promise<boolean> {
    try {
      const windowMs = 60 * 60_000;
      const now = Date.now();
      const member = `${now}:${randomUUID()}`;
      const account = this.keySubject(accountKey);
      const address = this.keySubject(ip);
      const result = await this.redis.eval(
        CHECK_EMAIL_RESEND,
        2,
        `auth:email-resend:account:${account}`,
        `auth:email-resend:ip:${address}`,
        now,
        windowMs,
        3,
        10,
        member,
      );
      return Number(result) === 1;
    } catch {
      throw new ServiceUnavailableException({ code: 'AUTH_LIMITER_UNAVAILABLE' });
    }
  }

  async isPasswordBlocked(accountKey: string): Promise<boolean> {
    return this.isBlocked('password', accountKey);
  }

  async isTotpBlocked(accountKey: string): Promise<boolean> {
    return this.isBlocked('totp', accountKey);
  }

  recordPasswordFailure(accountKey: string): Promise<boolean> {
    return this.recordFailure('password', accountKey, 5, 15 * 60_000, 15 * 60_000);
  }

  recordTotpFailure(accountKey: string): Promise<boolean> {
    return this.recordFailure('totp', accountKey, 5, 15 * 60_000, 15 * 60_000);
  }

  async resetPasswordFailures(accountKey: string): Promise<void> {
    await this.reset('password', accountKey);
  }

  async resetTotpFailures(accountKey: string): Promise<void> {
    await this.reset('totp', accountKey);
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }

  private async recordFailure(kind: 'password' | 'totp', accountKey: string, limit: number, windowMs: number, lockMs: number): Promise<boolean> {
    const key = this.keySubject(accountKey);
    const result = await this.runScript(RECORD_FAILURE, `auth:${kind}:${key}`, `auth:${kind}:lock:${key}`, windowMs, limit, lockMs);
    return Number(result[0]) === 1;
  }

  private async reset(kind: string, subject: string): Promise<void> {
    const key = this.keySubject(subject);
    try {
      await this.redis.eval(RESET_COUNTER, 2, `auth:${kind}:${key}`, `auth:${kind}:lock:${key}`);
    } catch {
      throw new ServiceUnavailableException({ code: 'AUTH_LIMITER_UNAVAILABLE' });
    }
  }

  private keySubject(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async isBlocked(kind: string, subject: string): Promise<boolean> {
    try {
      const ttl = await this.redis.pttl(`auth:${kind}:lock:${this.keySubject(subject)}`);
      return ttl > 0 || ttl === -1;
    } catch {
      throw new ServiceUnavailableException('AUTH_LIMITER_UNAVAILABLE');
    }
  }

  private async runScript(script: string, key: string, lockKey: string | null, windowMs: number, limit: number, lockMs = 0): Promise<unknown[]> {
    try {
      const now = Date.now();
      const member = `${now}:${randomUUID()}`;
      const keys = lockKey ? [key, lockKey] : [key];
      const args = lockKey
        ? [now, windowMs, limit, member, lockMs]
        : [now, windowMs, limit, member];
      const response = await this.redis.eval(script, keys.length, ...keys, ...args);
      return response as unknown[];
    } catch {
      throw new ServiceUnavailableException({ code: 'AUTH_LIMITER_UNAVAILABLE' });
    }
  }
}
