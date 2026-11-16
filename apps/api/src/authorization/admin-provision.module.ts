import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { AdminProvisionCommand } from './admin-provision.command';
import { PermissionsSeed } from './permissions.seed';
@Module({ imports: [DatabaseModule, AuditModule], providers: [AdminProvisionCommand, PermissionsSeed] })
export class AdminProvisionModule {}
