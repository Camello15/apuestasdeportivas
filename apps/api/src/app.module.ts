import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AuthenticationGuard } from './auth/guards/authentication.guard';
import { AuditModule } from './audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { UsersModule } from './users/users.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthorizationGuard } from './authorization/guards/authorization.guard';

@Module({
  imports: [DatabaseModule, AuditModule, UsersModule, AuthModule, AuthorizationModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule {}
