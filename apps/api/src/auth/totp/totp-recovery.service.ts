import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, UserStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { UsersService, normalizeEmail } from '../../users/users.service';
import { AuditService } from '../../audit/audit.service';
import { EMAIL_SENDER, EmailSender } from '../integrations/email.port';
import { PreAuthChallengeService } from './pre-auth-challenge.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
type RecoveryRequest = { userId: string; purpose: 'recover' | 'reenroll'; codeDigest?: string };
@Injectable()
export class TotpRecoveryService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? '', { lazyConnect: true, maxRetriesPerRequest: 1 });
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService,
    private readonly audit: AuditService, private readonly challenges: PreAuthChallengeService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender) {}

  async request(email: string, recoveryCode: string | undefined, context: { ipAddress?: string; device?: string }) {
    const user = await this.users.findByNormalizedEmail(normalizeEmail(email));
    if (!user || !user.emailVerifiedAt) return;
    let value: RecoveryRequest;
    let action: string;
    if (user.status === UserStatus.TOTP_REENROLLMENT_REQUIRED) {
      const existing = await this.prisma.totpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } });
      if (existing?.enabledAt) return;
      value = { userId: user.id, purpose: 'reenroll' };
      action = 'totp_reenrollment_email_requested';
    } else if (user.status === UserStatus.ACTIVE && recoveryCode) {
      const credential = await this.prisma.totpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } });
      if (!credential?.enabledAt) return;
      const codeDigest = sha256(recoveryCode.replace(/\s/g, '').toUpperCase());
      const code = await this.prisma.totpRecoveryCode.findFirst({ where: { userId: user.id, digest: codeDigest, consumedAt: null }, select: { id: true } });
      if (!code) {
        await this.audit.append({ actorId: user.id, actorType: 'USER', action: 'totp_recovery_rejected', ...context, targetType: 'user', targetId: user.id });
        return;
      }
      value = { userId: user.id, purpose: 'recover', codeDigest };
      action = 'totp_recovery_requested';
    } else return;
    const rawToken = randomBytes(32).toString('base64url');
    const key = `auth:totp:recovery-email:${sha256(rawToken)}`;
    try {
      const stored = await this.redis.set(key, JSON.stringify(value), 'EX', 15 * 60, 'NX');
      if (stored !== 'OK') throw new Error('recovery token collision');
      await this.audit.append({ actorId: user.id, actorType: 'USER', action, ...context, targetType: 'user', targetId: user.id });
      const origin = process.env.WEB_ORIGIN;
      if (!origin) throw new Error('WEB_ORIGIN unavailable');
      const url = new URL('/totp/recovery', origin); url.hash = rawToken;
      await this.email.sendTotpRecoveryEmail(user.email, url.toString());
    } catch { await this.redis.del(key).catch(() => undefined); throw new ServiceUnavailableException({ code: 'TOTP_RECOVERY_UNAVAILABLE' }); }
  }

  async complete(rawToken: string, context: { ipAddress?: string; device?: string }) {
    const redisKey = `auth:totp:recovery-email:${sha256(rawToken)}`;
    let recovery: RecoveryRequest;
    try {
      const value = await this.redis.get(redisKey);
      if (!value) throw new BadRequestException({ code: 'TOTP_RECOVERY_REJECTED' });
      recovery = JSON.parse(value) as RecoveryRequest;
      if (typeof recovery.userId !== 'string' || (recovery.purpose === 'recover' && typeof recovery.codeDigest !== 'string') || !['recover', 'reenroll'].includes(recovery.purpose)) throw new Error('invalid recovery payload');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException({ code: 'TOTP_RECOVERY_UNAVAILABLE' });
    }
    if (recovery.purpose === 'reenroll') {
      const user = await this.prisma.user.findUnique({ where: { id: recovery.userId }, select: { emailVerifiedAt: true, status: true } });
      if (!user?.emailVerifiedAt || user.status !== UserStatus.TOTP_REENROLLMENT_REQUIRED) throw new BadRequestException({ code: 'TOTP_RECOVERY_REJECTED' });
      const reenrollToken = await this.challenges.issue(recovery.userId, 'reenroll');
      const claimedReenroll = await this.redis.eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`, 1, redisKey, JSON.stringify(recovery));
      if (Number(claimedReenroll) !== 1) { await this.challenges.remove(reenrollToken); throw new BadRequestException({ code: 'TOTP_RECOVERY_REJECTED' }); }
      return { reenrollmentToken: reenrollToken };
    }
    if (recovery.purpose !== 'recover' || typeof recovery.codeDigest !== 'string') throw new BadRequestException({ code: 'TOTP_RECOVERY_REJECTED' });
    const claimed = await this.redis.eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`, 1, redisKey, JSON.stringify(recovery));
    if (Number(claimed) !== 1) throw new BadRequestException({ code: 'TOTP_RECOVERY_REJECTED' });
    const reenrollToken = await this.challenges.issue(recovery.userId, 'reenroll');
    const now = new Date();
    try {
      await this.prisma.$transaction(async tx => {
        const user = await tx.user.findUnique({ where: { id: recovery.userId }, select: { emailVerifiedAt: true, status: true } });
        if (!user?.emailVerifiedAt || user.status !== UserStatus.ACTIVE) throw new BadRequestException({ code: 'TOTP_RECOVERY_REJECTED' });
        const consumed = await tx.totpRecoveryCode.updateMany({ where: { userId: recovery.userId, digest: recovery.codeDigest, consumedAt: null }, data: { consumedAt: now } });
        if (consumed.count !== 1) throw new BadRequestException({ code: 'TOTP_RECOVERY_REJECTED' });
        await tx.totpRecoveryCode.updateMany({ where: { userId: recovery.userId, consumedAt: null }, data: { consumedAt: now } });
        await tx.totpCredential.deleteMany({ where: { userId: recovery.userId } });
        await tx.user.update({ where: { id: recovery.userId }, data: { status: UserStatus.TOTP_REENROLLMENT_REQUIRED } });
        await tx.authSession.updateMany({ where: { userId: recovery.userId, revokedAt: null }, data: { revokedAt: now, revokeReason: 'totp_recovery' } });
        await tx.refreshCredential.updateMany({ where: { session: { userId: recovery.userId }, revokedAt: null }, data: { revokedAt: now } });
        await this.audit.append({ actorId: recovery.userId, actorType: 'USER', action: 'totp_recovered', ...context, targetType: 'user', targetId: recovery.userId }, tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await this.challenges.remove(reenrollToken).catch(() => undefined);
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException({ code: 'TOTP_RECOVERY_UNAVAILABLE' });
    }
    return { reenrollmentToken: reenrollToken };
  }

  async onModuleDestroy() { this.redis.disconnect(); }
}
