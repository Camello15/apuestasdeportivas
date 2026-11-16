import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../auth-context';
import { Public } from '../decorators/public.decorator';
import { RequirePermissions } from '../../authorization/decorators/require-permissions.decorator';
import { LoginController } from '../login.controller';
import { PreAuthChallengeService } from './pre-auth-challenge.service';
import { TotpService } from './totp.service';

class TotpCodeDto { @IsString() @Matches(/^\d{6}$/) code!: string; }
class VerifyLoginDto extends TotpCodeDto { @IsString() @MinLength(32) @MaxLength(128) challengeToken!: string; }
class ReenrollCodeDto extends TotpCodeDto { @IsString() @MinLength(32) @MaxLength(128) reenrollmentToken!: string; }
@Controller('auth/totp')
export class TotpController {
  constructor(private readonly totp: TotpService, private readonly challenges: PreAuthChallengeService) {}

  @Post('setup') @RequirePermissions('auth:totp:manage')
  async setup(@Req() req: AuthenticatedRequest) { return this.totp.beginSetup(req.auth!.userId); }

  @Post('confirm') @RequirePermissions('auth:totp:manage')
  async confirm(@Body() body: TotpCodeDto, @Req() req: AuthenticatedRequest) {
    return this.totp.confirmSetup(req.auth!.userId, body.code, this.context(req));
  }

  @Public() @Post('verify-login') @HttpCode(HttpStatus.OK)
  async verifyLogin(@Body() body: VerifyLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const issued = await this.totp.verifyLogin(body.challengeToken, body.code, this.context(req));
    LoginController.setCookies(res, issued);
    return { message: 'Sesión iniciada.' };
  }

  @Public() @Post('recovery/setup')
  async recoverySetup(@Body() body: ReenrollCodeDto) { return this.totp.beginReenrollment(body.reenrollmentToken); }

  @Public() @Post('recovery/confirm')
  async recoveryConfirm(@Body() body: ReenrollCodeDto, @Req() req: Request) {
    return this.totp.confirmReenrollment(body.reenrollmentToken, body.code, this.context(req));
  }

  private context(req: Request) { return { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) }; }
}
