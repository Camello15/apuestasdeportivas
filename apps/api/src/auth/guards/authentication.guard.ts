import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../auth-context';
import { IS_PUBLIC_ROUTE } from '../decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';

type AccessClaims = { sub?: string; sid?: string; totpSatisfied?: boolean };

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readCookie(request.headers.cookie, 'access_token');
    const currentKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');
    if (!token || !currentKey || !process.env.JWT_ISSUER || !process.env.JWT_AUDIENCE) {
      await this.recordDenied(request);
      return false;
    }
    try {
      const encodedHeader = token.split('.')[0];
      const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as { alg?: string; kid?: string };
      if (header.alg !== 'RS256' || !header.kid) {
        await this.recordDenied(request);
        return false;
      }
      let key = header.kid === process.env.JWT_KEY_ID ? currentKey : undefined;
      if (process.env.JWT_PUBLIC_KEYS) {
        const keys = JSON.parse(process.env.JWT_PUBLIC_KEYS) as Record<string, unknown>;
        const found = keys[header.kid];
        if (typeof found === 'string') key = found.replace(/\\n/g, '\n');
      }
      if (!key) { await this.recordDenied(request); return false; }
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        publicKey: key, algorithms: ['RS256'], issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE,
      });
      return await this.loadPrincipal(request, claims);
    } catch { await this.recordDenied(request); return false; }
  }

  private async loadPrincipal(request: AuthenticatedRequest, claims: AccessClaims): Promise<boolean> {
    if (!claims.sub || !claims.sid) { await this.recordDenied(request); return false; }

    const session = await this.prisma.authSession.findFirst({
      where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, user: { select: { id: true, status: true, emailVerifiedAt: true, userRoles: { select: { role: { select: { name: true } } } } } } },
    });
    if (!session || session.user.status !== 'ACTIVE' || !session.user.emailVerifiedAt) { await this.recordDenied(request); return false; }
    request.auth = {
      userId: session.user.id,
      sessionId: session.id,
      roles: session.user.userRoles.map(({ role }) => role.name),
      totpSatisfied: claims.totpSatisfied === true,
    };
    return true;
  }

  private recordDenied(request: AuthenticatedRequest): Promise<unknown> {
    return this.audit.append({ actorType: 'ANONYMOUS', action: 'authentication_denied', ipAddress: request.ip, device: request.get('user-agent')?.slice(0, 512) });
  }

  private readCookie(header: string | undefined, name: string): string | undefined {
    const entry = header?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
    return entry?.slice(name.length + 1);
  }
}
