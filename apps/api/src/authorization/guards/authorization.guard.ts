import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../auth/auth-context';
import { IS_PUBLIC_ROUTE } from '../../auth/decorators/public.decorator';
import { PermissionPolicyService } from '../permission-policy.service';
import { REQUIRED_PERMISSIONS } from '../decorators/require-permissions.decorator';
import { AuditService } from '../../audit/audit.service';
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly policy: PermissionPolicyService, private readonly audit: AuditService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const permissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]);
    if (!request.auth || !permissions?.length || !await this.policy.allows(request.auth.userId, permissions)) {
      const actorType = !request.auth ? 'ANONYMOUS' : request.auth.roles.includes('administrador') ? 'ADMINISTRATOR' : 'USER';
      await this.audit.append({ actorId: request.auth?.userId, actorType, action: 'authorization_denied', ipAddress: request.ip, device: request.get('user-agent')?.slice(0, 512), metadata: { route: request.route?.path ?? request.path } });
      throw new ForbiddenException({ code: 'AUTHORIZATION_DENIED' });
    }
    return true;
  }
}
