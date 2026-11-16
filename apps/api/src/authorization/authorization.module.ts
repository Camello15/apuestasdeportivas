import { Module } from '@nestjs/common';
import { AuthorizationGuard } from './guards/authorization.guard';
import { PermissionPolicyService } from './permission-policy.service';
import { PermissionsSeed } from './permissions.seed';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { AuthModule } from '../auth/auth.module';
@Module({ imports: [AuthModule], controllers: [RolesController], providers: [PermissionPolicyService, PermissionsSeed, RolesService, AuthorizationGuard], exports: [PermissionPolicyService, PermissionsSeed, AuthorizationGuard] })
export class AuthorizationModule {}
