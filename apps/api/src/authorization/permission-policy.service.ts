import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class PermissionPolicyService {
  constructor(private readonly prisma: PrismaService) {}
  async allows(userId: string, required: string[]): Promise<boolean> {
    if (!required.length) return false;
    const assignments = await this.prisma.userRole.findMany({ where: { userId }, select: { role: { select: { permissions: { select: { permission: { select: { name: true } } } } } } } });
    const granted = new Set(assignments.flatMap(a => a.role.permissions.map(p => p.permission.name)));
    return required.every(permission => granted.has(permission));
  }
}
