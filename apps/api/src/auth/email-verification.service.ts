import { Inject, Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuditActorType, Prisma, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService, normalizeEmail } from '../users/users.service';
import { EMAIL_SENDER, EmailSender } from './integrations/email.port';
import { AttemptCounterService } from './abuse/attempt-counter.service';

const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly limits: AttemptCounterService,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
  ) {}

  async sendInitialVerification(user: User, rawToken: string, ipAddress?: string, device?: string): Promise<void> {
    try {
      await this.email.sendVerificationEmail(user.email, this.verificationUrl(rawToken));
      await this.audit.append({
        actorId: user.id, actorType: AuditActorType.USER, action: 'email_verification_sent',
        ipAddress, device, targetType: 'user', targetId: user.id,
      });
    } catch (error) {
      await this.prisma.emailActionToken.updateMany({
        where: { userId: user.id, type: 'VERIFY_EMAIL', digest: tokenDigest(rawToken), consumedAt: null },
        data: { invalidatedAt: new Date() },
      });
      await this.audit.append({
        actorId: user.id, actorType: AuditActorType.USER, action: 'email_verification_send_failed',
        ipAddress, device, targetType: 'user', targetId: user.id,
      });
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE' });
    }
  }

  async resend(email: string, ipAddress?: string, device?: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    const allowed = await this.limits.checkEmailVerificationResend(normalizedEmail, ipAddress ?? 'unknown');
    if (!allowed) {
      await this.audit.append({ actorType: AuditActorType.ANONYMOUS, action: 'email_verification_resend_rate_limited', ipAddress, device });
      return;
    }
    const user = await this.users.findByNormalizedEmail(normalizedEmail);
    if (!user || user.emailVerifiedAt) return;

    const rawToken = randomBytes(32).toString('base64url');
    const digest = tokenDigest(rawToken);
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.emailActionToken.updateMany({
        where: { userId: user.id, type: 'VERIFY_EMAIL', consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      });
      await transaction.emailActionToken.create({ data: {
        userId: user.id, type: 'VERIFY_EMAIL', digest,
        expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
      } });
      await this.audit.append({
        actorId: user.id, actorType: AuditActorType.USER, action: 'email_verification_resent',
        ipAddress, device, targetType: 'user', targetId: user.id,
      }, transaction);
    });

    try {
      await this.email.sendVerificationEmail(user.email, this.verificationUrl(rawToken));
    } catch {
      await this.prisma.emailActionToken.updateMany({
        where: { userId: user.id, type: 'VERIFY_EMAIL', digest, consumedAt: null },
        data: { invalidatedAt: new Date() },
      });
      await this.audit.append({
        actorId: user.id, actorType: AuditActorType.USER, action: 'email_verification_send_failed',
        ipAddress, device, targetType: 'user', targetId: user.id,
      });
      throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE' });
    }
  }

  async verify(rawToken: string, ipAddress?: string, device?: string): Promise<void> {
    const digest = tokenDigest(rawToken);
    const now = new Date();
    try {
      await this.prisma.$transaction(async (transaction) => {
        const record = await transaction.emailActionToken.findUnique({ where: { digest }, select: { id: true, userId: true, type: true, expiresAt: true, consumedAt: true, invalidatedAt: true } });
        if (!record || record.type !== 'VERIFY_EMAIL' || record.expiresAt <= now || record.consumedAt || record.invalidatedAt) {
          throw new BadRequestException({ code: 'EMAIL_VERIFICATION_INVALID' });
        }
        const consumed = await transaction.emailActionToken.updateMany({
          where: { id: record.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw new BadRequestException({ code: 'EMAIL_VERIFICATION_INVALID' });
        await transaction.user.update({
          where: { id: record.userId },
          data: { emailVerifiedAt: now, status: 'ACTIVE' },
        });
        await this.audit.append({
          actorId: record.userId, actorType: AuditActorType.USER, action: 'email_verified',
          ipAddress, device, targetType: 'user', targetId: record.userId,
        }, transaction);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.audit.append({ actorType: 'ANONYMOUS', action: 'email_verification_rejected', ipAddress, device });
        throw error;
      }
      throw new ServiceUnavailableException({ code: 'EMAIL_VERIFICATION_UNAVAILABLE' });
    }
  }

  private verificationUrl(token: string): string {
    const origin = process.env.WEB_ORIGIN;
    if (!origin) throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE' });
    const url = new URL('/verify-email', origin);
    url.hash = token;
    return url.toString();
  }
}
