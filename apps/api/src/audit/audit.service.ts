import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export type AuditInput = {
  actorId?: string;
  actorType: AuditActorType;
  action: string;
  ipAddress?: string;
  device?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  append(input: AuditInput, transaction: Prisma.TransactionClient = this.prisma): Promise<unknown> {
    return transaction.auditEvent.create({ data: {
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      ipAddress: input.ipAddress ?? 'unknown',
      device: input.device ?? 'unknown',
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: sanitizeMetadata(input.metadata),
    } });
  }
}

function sanitizeMetadata(value: Prisma.InputJsonValue | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => sanitizeMetadata(item) ?? null);
  const safe: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|token|secret|totp|recovery.?code|credential|authorization/i.test(key)) safe[key] = '[REDACTED]';
    else safe[key] = sanitizeMetadata(item as Prisma.InputJsonValue) ?? null;
  }
  return safe;
}
