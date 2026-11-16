import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { AuthenticatedRequest } from './auth-context';
import { SessionService } from './session.service';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
@Controller('auth/admin/sessions')
@RequirePermissions('admin:sessions:revoke')
export class AdminSessionsController {
  constructor(private readonly sessions: SessionService) {}
  @Post(':userId/revoke') @HttpCode(HttpStatus.OK)
  async revoke(@Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Req() req: AuthenticatedRequest) {
    const count = await this.sessions.revokeAllByAdmin(userId, req.auth!.userId, { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) });
    return { revokedSessions: count };
  }
}
