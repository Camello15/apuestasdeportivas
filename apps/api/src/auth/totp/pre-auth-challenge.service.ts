import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import Redis from 'ioredis';

type Challenge = { userId: string; purpose: 'login' | 'reenroll' };
const TAKE_IF_MATCH = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
@Injectable()
export class PreAuthChallengeService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? '', { lazyConnect: true, maxRetriesPerRequest: 1 });
  async issue(userId: string, purpose: Challenge['purpose'] = 'login'): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    try {
      const stored = await this.redis.set(this.key(token), JSON.stringify({ userId, purpose }), 'EX', 300, 'NX');
      if (stored !== 'OK') throw new Error('challenge collision');
    }
    catch { throw new ServiceUnavailableException({ code: 'AUTH_CHALLENGE_UNAVAILABLE' }); }
    return token;
  }
  async read(token: string): Promise<Challenge | null> {
    try {
      const value = await this.redis.get(this.key(token));
      if (!value) return null;
      const data = JSON.parse(value) as Partial<Challenge>;
      return typeof data.userId === 'string' && (data.purpose === 'login' || data.purpose === 'reenroll')
        ? { userId: data.userId, purpose: data.purpose } : null;
    } catch { throw new ServiceUnavailableException({ code: 'AUTH_CHALLENGE_UNAVAILABLE' }); }
  }
  async consume(token: string, expected: Challenge): Promise<boolean> {
    try { return Number(await this.redis.eval(TAKE_IF_MATCH, 1, this.key(token), JSON.stringify(expected))) === 1; }
    catch { throw new ServiceUnavailableException({ code: 'AUTH_CHALLENGE_UNAVAILABLE' }); }
  }
  async remove(token: string): Promise<void> {
    try { await this.redis.del(this.key(token)); }
    catch { throw new ServiceUnavailableException({ code: 'AUTH_CHALLENGE_UNAVAILABLE' }); }
  }
  async onModuleDestroy() { this.redis.disconnect(); }
  private key(token: string) { return `auth:preauth:${createHash('sha256').update(token).digest('hex')}`; }
}
