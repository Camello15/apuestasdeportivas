import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  apostador: ['session:logout', 'auth:totp:manage'],
  operador: ['session:logout', 'auth:totp:manage', 'operator:matches:manage', 'operator:markets:manage', 'operator:promotions:manage'],
  administrador: ['session:logout', 'auth:totp:manage', 'operator:matches:manage', 'operator:markets:manage', 'operator:promotions:manage', 'admin:roles:manage', 'admin:sessions:revoke', 'admin:audit:read'],
};

/** Run only from the controlled deployment/maintenance procedure, never from public registration. */
@Injectable()
export class PermissionsSeed {
  constructor(private readonly prisma: PrismaService) {}
  async apply(): Promise<void> {
    await this.prisma.$transaction(async tx => {
      for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        const role = await tx.role.upsert({ where: { name: roleName }, create: { name: roleName }, update: {} });
        for (const permissionName of permissions) {
          const permission = await tx.permission.upsert({ where: { name: permissionName }, create: { name: permissionName }, update: {} });
          await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, create: { roleId: role.id, permissionId: permission.id }, update: {} });
        }
      }
    });
  }
}
