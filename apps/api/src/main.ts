import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { validateEnvironment } from './config/env.validation';
import { AuthErrorFilter } from './common/errors/auth-error.filter';
import { createStrictValidationPipe } from './common/validation/validation.pipe';
import { AdminProvisionModule } from './authorization/admin-provision.module';
import { AdminProvisionCommand } from './authorization/admin-provision.command';
import { PermissionsSeed } from './authorization/permissions.seed';
import { AuditRetentionModule } from './audit/audit-retention.module';
import { AuditRetentionService } from './audit/audit-retention.service';

async function bootstrap() {
  const envFile = [resolve(process.cwd(), '.env'), resolve(process.cwd(), 'apps/api/.env')]
    .find((candidate) => existsSync(candidate));
  if (envFile) process.loadEnvFile(envFile);
  if (process.argv[2] === 'audit:retention') {
    const cli = await NestFactory.createApplicationContext(AuditRetentionModule, { logger: ['error', 'log'] });
    try { await cli.get(AuditRetentionService).purgeExpired(); }
    finally { await cli.close(); }
    return;
  }
  if (process.argv[2] === 'auth:seed' || process.argv[2] === 'provision-admin') {
    if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required for controlled administrator provisioning');
    process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
    const cli = await NestFactory.createApplicationContext(AdminProvisionModule, { logger: ['error'] });
    try {
      if (process.argv[2] === 'auth:seed') {
        await cli.get(PermissionsSeed).apply();
        return;
      }
      const email = process.env.ADMIN_PROVISION_EMAIL;
      if (!email) throw new Error('Set ADMIN_PROVISION_EMAIL to an already verified account');
      await cli.get(AdminProvisionCommand).execute(email);
    } finally { await cli.close(); }
    return;
  }
  validateEnvironment(process.env);

  const app = await NestFactory.create(AppModule);
  const configuredProxyHops = process.env.TRUST_PROXY_HOPS;
  const trustProxyHops = configuredProxyHops === undefined ? 0 : Number(configuredProxyHops);
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  app.useGlobalPipes(createStrictValidationPipe());
  app.useGlobalFilters(new AuthErrorFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.API_PORT ?? 3001);
}
void bootstrap();
