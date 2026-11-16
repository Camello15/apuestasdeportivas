import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TokenService } from './token.service';

const REFRESH_MS = 7 * 24 * 60 * 60_000;
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService, private readonly tokens: TokenService, private readonly audit: AuditService) {}

  async create(userId: string, context: { ipAddress?: string; device?: string }, totpSatisfied = false) {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refresh = this.tokens.createRefreshToken(totpSatisfied);
    const accessToken = await this.tokens.createAccessToken(userId, sessionId, totpSatisfied);
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      await tx.authSession.create({ data: { id: sessionId, userId, familyId, expiresAt: new Date(now.getTime() + REFRESH_MS) } });
      await tx.refreshCredential.create({ data: { sessionId, digest: refresh.digest, jti: refresh.jti, expiresAt: new Date(now.getTime() + REFRESH_MS) } });
      await this.audit.append({ actorId: userId, actorType: 'USER', action: 'session_created', ...context, targetType: 'session', targetId: sessionId }, tx);
      await this.audit.append({ actorId: userId, actorType: 'USER', action: 'login_succeeded', ...context, targetType: 'user', targetId: userId }, tx);
    });
    return { accessToken, refreshToken: refresh.token };
  }

  async rotate(raw: string, context: { ipAddress?: string; device?: string }) {
    const existing = await this.prisma.refreshCredential.findUnique({ where: { digest: this.tokens.refreshDigest(raw) }, include: { session: { include: { user: { select: { status: true, emailVerifiedAt: true } } } } } });
    if (!existing) throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    if (existing.consumedAt || existing.revokedAt) {
      await this.revokeSession(existing.sessionId, 'refresh_replay', context);
      throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    }
    if (existing.expiresAt <= new Date() || existing.session.revokedAt || existing.session.expiresAt <= new Date() || existing.session.user.status !== 'ACTIVE' || !existing.session.user.emailVerifiedAt) throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    const totpSatisfied = existing.jti.startsWith('t1.');
    const next = this.tokens.createRefreshToken(totpSatisfied);
    const nextId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_MS);
    const accessToken = await this.tokens.createAccessToken(existing.session.userId, existing.sessionId, totpSatisfied);
    try {
      await this.prisma.$transaction(async tx => {
        const consumed = await tx.refreshCredential.updateMany({ where: { id: existing.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now, replacedBy: nextId } });
        if (consumed.count !== 1) throw new UnauthorizedException({ code: 'SESSION_INVALID' });
        await tx.authSession.update({ where: { id: existing.sessionId }, data: { expiresAt } });
        await tx.refreshCredential.create({ data: { id: nextId, sessionId: existing.sessionId, digest: next.digest, jti: next.jti, expiresAt } });
        await this.audit.append({ actorId: existing.session.userId, actorType: 'USER', action: 'session_refresh_rotated', ...context, targetType: 'session', targetId: existing.sessionId }, tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof UnauthorizedException || (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034')) {
        await this.revokeSession(existing.sessionId, 'refresh_replay', context);
        throw new UnauthorizedException({ code: 'SESSION_INVALID' });
      }
      throw new ServiceUnavailableException({ code: 'SESSION_UNAVAILABLE' });
    }
    return { accessToken, refreshToken: next.token };
  }

  async revokeSession(sessionId: string, reason: string, context: { ipAddress?: string; device?: string } = {}) {
    await this.prisma.$transaction(async tx => {
      const session = await tx.authSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
      if (!session) return;
      const changed = await tx.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
      await tx.refreshCredential.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
      if (changed.count) await this.audit.append({ actorId: session.userId, actorType: 'USER', action: 'session_revoked', ...context, targetType: 'session', targetId: sessionId, metadata: { reason } }, tx);
    });
  }

  async revokeAll(userId: string, reason: string, context: { ipAddress?: string; device?: string } = {}) {
    await this.prisma.$transaction(tx => this.revokeAllInTransaction(tx, userId, reason, context, userId, 'USER'));
  }

  async revokeAllByAdmin(userId: string, actorId: string, context: { ipAddress?: string; device?: string }) {
    return this.prisma.$transaction(async tx => {
      const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) throw new UnauthorizedException({ code: 'ADMIN_ACTION_REJECTED' });
      return this.revokeAllInTransaction(tx, userId, 'admin_security', context, actorId, 'ADMINISTRATOR');
    });
  }

  async revokeAllInTransaction(tx: Prisma.TransactionClient, userId: string, reason: string,
    context: { ipAddress?: string; device?: string }, actorId: string, actorType: 'USER' | 'ADMINISTRATOR' | 'SYSTEM') {
    const now = new Date();
    const active = await tx.authSession.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, revokeReason: reason } });
    await tx.refreshCredential.updateMany({ where: { session: { userId }, revokedAt: null }, data: { revokedAt: now } });
    await this.audit.append({ actorId, actorType, action: 'sessions_revoked_all', ...context, targetType: 'user', targetId: userId, metadata: { reason, count: active.length } }, tx);
    return active.length;
  }

}
