import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly sessions: SessionService) {}

  async listUsers(take = 50) {
    return this.prisma.user.findMany({ take: Math.min(Math.max(take, 1), 50), orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, emailVerifiedAt: true, status: true, userRoles: { select: { role: { select: { name: true } } } } } });
  }

  assignOperator(actorId: string, targetId: string, context: { ipAddress?: string; device?: string }) {
    return this.changeOperatorRole(actorId, targetId, context, true);
  }
  removeOperator(actorId: string, targetId: string, context: { ipAddress?: string; device?: string }) {
    return this.changeOperatorRole(actorId, targetId, context, false);
  }

  private async changeOperatorRole(actorId: string, targetId: string, context: { ipAddress?: string; device?: string }, assign: boolean) {
    if (actorId === targetId) throw new BadRequestException({ code: 'ROLE_CHANGE_REJECTED' });
    return this.prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true } });
      const role = await tx.role.findUnique({ where: { name: 'operador' }, select: { id: true } });
      if (!target || !role) throw new NotFoundException({ code: 'ROLE_TARGET_UNAVAILABLE' });
      let changed = false;
      if (assign) {
        const existing = await tx.userRole.findUnique({ where: { userId_roleId: { userId: targetId, roleId: role.id } }, select: { userId: true } });
        if (!existing) { await tx.userRole.create({ data: { userId: targetId, roleId: role.id } }); changed = true; }
      } else {
        const result = await tx.userRole.deleteMany({ where: { userId: targetId, roleId: role.id } }); changed = result.count > 0;
      }
      if (changed) {
        await this.audit.append({ actorId, actorType: AuditActorType.ADMINISTRATOR, action: assign ? 'operator_role_assigned' : 'operator_role_removed', ...context, targetType: 'user', targetId }, tx);
        await this.sessions.revokeAllInTransaction(tx, targetId, 'role_changed', context, actorId, 'ADMINISTRATOR');
      }
      return { changed };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
