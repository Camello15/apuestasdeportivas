import { Module } from '@nestjs/common';
import { AuditRetentionService } from './audit-retention.service';
@Module({ providers: [AuditRetentionService] })
export class AuditRetentionModule {}
