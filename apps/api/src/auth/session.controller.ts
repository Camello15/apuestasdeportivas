import { Controller, Post, Req, Res, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from './decorators/public.decorator';
import { SessionService } from './session.service';
import { LoginController } from './login.controller';
import { AuthenticatedRequest } from './auth-context';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
@Controller('auth/session')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}
  @Public() @Post('refresh') @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = this.cookie(req.headers.cookie, 'refresh_token');
    if (!raw) throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    const session = await this.sessions.rotate(raw, { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) });
    LoginController.setCookies(res, session);
    return { message: 'Sesión renovada.' };
  }
  @Post('logout') @HttpCode(HttpStatus.NO_CONTENT) @RequirePermissions('session:logout')
  async logout(@Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    if (!req.auth?.sessionId) throw new UnauthorizedException();
    await this.sessions.revokeSession(req.auth.sessionId, 'logout', { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) });
    res.clearCookie('access_token', { path: '/', sameSite: 'lax', secure: true });
    res.clearCookie('refresh_token', { path: '/', sameSite: 'lax', secure: true });
    return undefined;
  }
  private cookie(header: string | undefined, name: string) { return header?.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1); }
}
