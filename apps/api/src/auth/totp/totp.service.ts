import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AttemptCounterService } from '../abuse/attempt-counter.service';
import { SessionService } from '../session.service';
import { TotpCryptoService } from './totp-crypto.service';
import { PreAuthChallengeService } from './pre-auth-challenge.service';

type PendingSetup = { ciphertext: string; keyVersion: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const setupTtlSeconds = 600;
const recoveryCode = () => randomBytes(10).toString('hex').toUpperCase();

@Injectable()
export class TotpService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? '', { lazyConnect: true, maxRetriesPerRequest: 1 });
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly crypto: TotpCryptoService, private readonly limits: AttemptCounterService,
    private readonly challenges: PreAuthChallengeService, private readonly sessions: SessionService) {}

  async beginSetup(userId: string, issuer = 'Apuestas Deportivas') {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException({ code: 'TOTP_SETUP_REJECTED' });
    const current = await this.prisma.totpCredential.findUnique({ where: { userId }, select: { enabledAt: true } });
    if (current?.enabledAt) throw new BadRequestException({ code: 'TOTP_ALREADY_ENABLED' });
    const secret = encodeBase32(randomBytes(20));
    const pending: PendingSetup = { ciphertext: this.crypto.encrypt(secret), keyVersion: this.crypto.keyVersion() };
    try { await this.redis.set(`auth:totp:setup:${userId}`, JSON.stringify(pending), 'EX', setupTtlSeconds); }
    catch { throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' }); }
    return { secret, provisioningUri: otpAuthUri(issuer, user.email, secret) };
  }

  async confirmSetup(userId: string, code: string, context: { ipAddress?: string; device?: string }) {
    const pending = await this.readPending(`auth:totp:setup:${userId}`);
    const secret = this.crypto.decrypt(pending.ciphertext, pending.keyVersion);
    const step = matchTotp(secret, code);
    if (step === null) throw new BadRequestException({ code: 'TOTP_CODE_INVALID' });
    const codes = Array.from({ length: 10 }, recoveryCode);
    await this.storeConfirmed(userId, pending, codes, step, context, false);
    await this.redis.del(`auth:totp:setup:${userId}`).catch(() => undefined);
    return { recoveryCodes: codes };
  }

  async verifyLogin(token: string, code: string, context: { ipAddress?: string; device?: string }) {
    if (!context.ipAddress || !await this.limits.checkIpAttempt(context.ipAddress)) {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'totp_login_ip_rate_limited', ...context });
      throw new UnauthorizedException({ code: 'AUTHENTICATION_FAILED' });
    }
    const challenge = await this.challenges.read(token);
    if (!challenge || challenge.purpose !== 'login') {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'totp_login_challenge_rejected', ...context });
      throw new UnauthorizedException({ code: 'AUTHENTICATION_FAILED' });
    }
    const user = await this.prisma.user.findUnique({ where: { id: challenge.userId }, select: { id: true, normalizedEmail: true, status: true, emailVerifiedAt: true } });
    const credential = await this.prisma.totpCredential.findUnique({ where: { userId: challenge.userId } });
    if (!user || user.status !== 'ACTIVE' || !user.emailVerifiedAt || !credential?.enabledAt) throw new UnauthorizedException({ code: 'AUTHENTICATION_FAILED' });
    if (await this.limits.isTotpBlocked(user.id)) {
      await this.audit.append({ actorId: user.id, actorType: 'USER', action: 'totp_login_blocked', ...context, targetType: 'user', targetId: user.id });
      throw new UnauthorizedException({ code: 'AUTHENTICATION_FAILED' });
    }

    const secret = this.crypto.decrypt(credential.secretCiphertext, credential.keyVersion);
    const step = matchTotp(secret, code);
    if (step === null) return this.recordTotpFailure(user.id, token, context);
    const accepted = await this.prisma.totpCredential.updateMany({
      where: { userId: user.id, enabledAt: { not: null }, OR: [{ lastAcceptedTotpStep: null }, { lastAcceptedTotpStep: { lt: BigInt(step) } }] },
      data: { lastAcceptedTotpStep: BigInt(step) },
    });
    if (accepted.count !== 1) return this.recordTotpFailure(user.id, token, context);
    if (!await this.challenges.consume(token, { userId: user.id, purpose: 'login' })) throw new UnauthorizedException({ code: 'AUTHENTICATION_FAILED' });
    await this.limits.resetTotpFailures(user.id);
    await this.limits.resetPasswordFailures(digest(user.normalizedEmail));
    return this.sessions.create(user.id, context, true);
  }

  async beginReenrollment(token: string, issuer = 'Apuestas Deportivas') {
    const challenge = await this.challenges.read(token);
    if (!challenge || challenge.purpose !== 'reenroll') throw new UnauthorizedException({ code: 'TOTP_RECOVERY_REJECTED' });
    const user = await this.prisma.user.findUnique({ where: { id: challenge.userId }, select: { email: true, status: true } });
    if (!user || user.status !== 'TOTP_REENROLLMENT_REQUIRED') throw new UnauthorizedException({ code: 'TOTP_RECOVERY_REJECTED' });
    const secret = encodeBase32(randomBytes(20));
    const pending = { ciphertext: this.crypto.encrypt(secret), keyVersion: this.crypto.keyVersion() };
    try { await this.redis.set(`auth:totp:reenroll:${digest(token)}`, JSON.stringify(pending), 'EX', 300); }
    catch { throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' }); }
    return { secret, provisioningUri: otpAuthUri(issuer, user.email, secret) };
  }

  async confirmReenrollment(token: string, code: string, context: { ipAddress?: string; device?: string }) {
    const challenge = await this.challenges.read(token);
    if (!challenge || challenge.purpose !== 'reenroll') throw new UnauthorizedException({ code: 'TOTP_RECOVERY_REJECTED' });
    const key = `auth:totp:reenroll:${digest(token)}`;
    const pending = await this.readPending(key);
    const secret = this.crypto.decrypt(pending.ciphertext, pending.keyVersion);
    const step = matchTotp(secret, code);
    if (step === null) throw new BadRequestException({ code: 'TOTP_CODE_INVALID' });
    const codes = Array.from({ length: 10 }, recoveryCode);
    await this.storeConfirmed(challenge.userId, pending, codes, step, context, true);
    if (!await this.challenges.consume(token, challenge)) throw new UnauthorizedException({ code: 'TOTP_RECOVERY_REJECTED' });
    await this.redis.del(key).catch(() => undefined);
    return { recoveryCodes: codes };
  }

  async onModuleDestroy() { this.redis.disconnect(); }

  private async readPending(key: string): Promise<PendingSetup> {
    try {
      const value = await this.redis.get(key);
      if (!value) throw new BadRequestException({ code: 'TOTP_SETUP_EXPIRED' });
      const parsed = JSON.parse(value) as Partial<PendingSetup>;
      if (typeof parsed.ciphertext !== 'string' || typeof parsed.keyVersion !== 'string') throw new Error('invalid pending setup');
      return { ciphertext: parsed.ciphertext, keyVersion: parsed.keyVersion };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' });
    }
  }

  private async storeConfirmed(userId: string, pending: PendingSetup, codes: string[], step: number,
    context: { ipAddress?: string; device?: string }, reenroll: boolean) {
    const codeRows = codes.map(value => ({ userId, digest: digest(value) }));
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!user || (reenroll ? user.status !== 'TOTP_REENROLLMENT_REQUIRED' : user.status !== 'ACTIVE')) throw new UnauthorizedException({ code: 'TOTP_SETUP_REJECTED' });
      const existing = await tx.totpCredential.findUnique({ where: { userId }, select: { enabledAt: true } });
      if (existing?.enabledAt) throw new BadRequestException({ code: 'TOTP_ALREADY_ENABLED' });
      if (existing) {
        const changed = await tx.totpCredential.updateMany({ where: { userId, enabledAt: null }, data: { secretCiphertext: pending.ciphertext, keyVersion: pending.keyVersion, enabledAt: now, lastAcceptedTotpStep: BigInt(step) } });
        if (changed.count !== 1) throw new BadRequestException({ code: 'TOTP_SETUP_REJECTED' });
      } else {
        await tx.totpCredential.create({ data: { userId, secretCiphertext: pending.ciphertext, keyVersion: pending.keyVersion, enabledAt: now, lastAcceptedTotpStep: BigInt(step) } });
      }
      await tx.totpRecoveryCode.createMany({ data: codeRows });
      if (reenroll) await tx.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
      await this.audit.append({ actorId: userId, actorType: 'USER', action: reenroll ? 'totp_reenrollment_completed' : 'totp_enabled', ...context, targetType: 'user', targetId: userId }, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async recordTotpFailure(userId: string, challengeToken: string, context: { ipAddress?: string; device?: string }): Promise<never> {
    await this.limits.recordTotpFailure(userId);
    await this.audit.append({ actorId: userId, actorType: 'USER', action: 'totp_login_failed', ...context, targetType: 'user', targetId: userId });
    throw new UnauthorizedException({ code: 'AUTHENTICATION_FAILED' });
  }
}

function encodeBase32(input: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0; let value = 0; let output = '';
  for (const byte of input) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function decodeBase32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0; let value = 0; const bytes: number[] = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) { const index = alphabet.indexOf(char); if (index < 0) throw new Error('invalid base32'); value = (value << 5) | index; bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(bytes);
}
function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const digestBytes = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digestBytes[digestBytes.length - 1] & 0x0f;
  const binary = ((digestBytes[offset] & 0x7f) << 24) | ((digestBytes[offset + 1] & 0xff) << 16) | ((digestBytes[offset + 2] & 0xff) << 8) | (digestBytes[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}
function matchTotp(secret: string, code: string): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const supplied = Buffer.from(code);
  const current = Math.floor(Date.now() / 30_000);
  for (const step of [current + 1, current, current - 1]) {
    const expected = Buffer.from(totpAt(secret, step));
    if (timingSafeEqual(supplied, expected)) return step;
  }
  return null;
}
function otpAuthUri(issuer: string, email: string, secret: string): string {
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
