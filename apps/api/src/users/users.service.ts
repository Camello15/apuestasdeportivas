import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByNormalizedEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { normalizedEmail: normalizeEmail(email) } });
  }

  createPendingAccount(input: {
    email: string;
    normalizedEmail: string;
    passwordHash: string;
    emailTokenDigest: string;
    emailTokenExpiresAt: Date;
    ipAddress?: string;
    device?: string;
  }): Promise<User> {
    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.findUnique({ where: { name: 'apostador' } });
      if (!role) throw new Error('Required role catalog is not initialized');

      const user = await transaction.user.create({ data: {
        email: input.email.trim(),
        normalizedEmail: input.normalizedEmail,
        passwordHash: input.passwordHash,
        ageDeclared: true,
        status: 'PENDING_EMAIL',
        userRoles: { create: { roleId: role.id } },
        emailActionTokens: { create: {
          type: 'VERIFY_EMAIL',
          digest: input.emailTokenDigest,
          expiresAt: input.emailTokenExpiresAt,
        } },
      } });

      await transaction.auditEvent.create({ data: {
        actorType: 'ANONYMOUS',
        action: 'registration_created',
        ipAddress: input.ipAddress,
        device: input.device,
        targetType: 'user',
        targetId: user.id,
      } });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
