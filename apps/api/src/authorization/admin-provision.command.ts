import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { normalizeEmail } from '../users/users.service';

@Injectable()
export class AdminProvisionCommand {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async execute(email: string): Promise<void> {
    const userEmail = normalizeEmail(email);
    await this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { normalizedEmail: userEmail }, select: { id: true, status: true, emailVerifiedAt: true } });
      if (!user || !user.emailVerifiedAt || user.status !== 'ACTIVE') throw new NotFoundException('A verified active user is required');
      const role = await tx.role.findUnique({ where: { name: 'administrador' }, select: { id: true } });
      if (!role) throw new NotFoundException('RBAC catalog must be initialized first');
      const existing = await tx.userRole.count({ where: { roleId: role.id } });
      if (existing > 0) throw new ConflictException('An administrator has already been provisioned');
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      await this.audit.append({ actorType: AuditActorType.SYSTEM, action: 'initial_administrator_provisioned', targetType: 'user', targetId: user.id, metadata: { mechanism: 'controlled_command' } }, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
