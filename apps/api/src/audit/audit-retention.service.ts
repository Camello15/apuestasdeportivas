import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class AuditRetentionService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly prisma: PrismaClient;
  constructor() {
    const url = process.env.AUDIT_MAINTENANCE_DATABASE_URL;
    if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) {
      throw new ServiceUnavailableException({ code: 'AUDIT_MAINTENANCE_UNAVAILABLE' });
    }
    this.prisma = new PrismaClient({ datasources: { db: { url } } });
  }
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    let deleted = 0;
    try {
      await this.prisma.$connect();
      while (true) {
        const batch = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          WITH expired AS (
            SELECT id FROM audit_events
            WHERE occurred_at < ${cutoff}
            ORDER BY occurred_at
            LIMIT 500
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM audit_events AS event
          USING expired
          WHERE event.id = expired.id
          RETURNING event.id
        `);
        deleted += batch.length;
        if (batch.length < 500) break;
      }
      this.logger.log(JSON.stringify({ event: 'audit_retention_completed', deletedCount: deleted }));
      return deleted;
    } catch {
      this.logger.error(JSON.stringify({ event: 'audit_retention_failed' }));
      throw new ServiceUnavailableException({ code: 'AUDIT_MAINTENANCE_UNAVAILABLE' });
    }
  }
  async onModuleDestroy() { await this.prisma.$disconnect(); }
}
