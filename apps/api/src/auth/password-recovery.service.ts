import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UsersService, normalizeEmail } from '../users/users.service';
import { EMAIL_SENDER, EmailSender } from './integrations/email.port';
import { AuditService } from '../audit/audit.service';

const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const RESET_MS = 30 * 60_000;
@Injectable()
export class PasswordRecoveryService {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService,
    private readonly audit: AuditService, @Inject(EMAIL_SENDER) private readonly email: EmailSender) {}

  async request(email: string, context: { ipAddress?: string; device?: string }) {
    const user = await this.users.findByNormalizedEmail(normalizeEmail(email));
    if (!user?.emailVerifiedAt || user.status !== 'ACTIVE') return;
    const token = randomBytes(32).toString('base64url');
    const digest = hashToken(token);
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      await tx.emailActionToken.updateMany({ where: { userId: user.id, type: 'RESET_PASSWORD', consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
      await tx.emailActionToken.create({ data: { userId: user.id, type: 'RESET_PASSWORD', digest, expiresAt: new Date(now.getTime() + RESET_MS) } });
      await this.audit.append({ actorId: user.id, actorType: 'USER', action: 'password_reset_requested', ...context, targetType: 'user', targetId: user.id }, tx);
    });
    const origin = process.env.WEB_ORIGIN;
    if (!origin) throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE' });
    const url = new URL('/password/reset', origin); url.hash = token;
    try { await this.email.sendPasswordResetEmail(user.email, url.toString()); }
    catch {
      await this.prisma.$transaction(async tx => {
        await tx.emailActionToken.updateMany({ where: { digest, consumedAt: null }, data: { invalidatedAt: new Date() } });
        await this.audit.append({ actorId: user.id, actorType: 'USER', action: 'password_reset_email_failed', ...context, targetType: 'user', targetId: user.id }, tx);
      });
      throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE' });
    }
  }

  async reset(token: string, passwordHash: string, context: { ipAddress?: string; device?: string }) {
    const now = new Date();
    try {
      await this.prisma.$transaction(async tx => {
        const action = await tx.emailActionToken.findUnique({ where: { digest: hashToken(token) } });
        if (!action || action.type !== 'RESET_PASSWORD' || action.expiresAt <= now || action.consumedAt || action.invalidatedAt) throw new Error('invalid reset');
        const claimed = await tx.emailActionToken.updateMany({ where: { id: action.id, type: 'RESET_PASSWORD', consumedAt: null, invalidatedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
        if (claimed.count !== 1) throw new Error('invalid reset');
        await tx.user.update({ where: { id: action.userId }, data: { passwordHash } });
        await tx.authSession.updateMany({ where: { userId: action.userId, revokedAt: null }, data: { revokedAt: now, revokeReason: 'password_reset' } });
        await tx.refreshCredential.updateMany({ where: { session: { userId: action.userId }, revokedAt: null }, data: { revokedAt: now } });
        await this.audit.append({ actorId: action.userId, actorType: 'USER', action: 'password_reset_completed', ...context, targetType: 'user', targetId: action.userId }, tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch { throw new ServiceUnavailableException({ code: 'PASSWORD_RESET_REJECTED' }); }
  }

  async assertResetToken(token: string): Promise<void> {
    const action = await this.prisma.emailActionToken.findUnique({ where: { digest: hashToken(token) }, select: { type: true, expiresAt: true, consumedAt: true, invalidatedAt: true } });
    if (!action || action.type !== 'RESET_PASSWORD' || action.expiresAt <= new Date() || action.consumedAt || action.invalidatedAt) {
      throw new BadRequestException({ code: 'PASSWORD_RESET_REJECTED' });
    }
  }
}
