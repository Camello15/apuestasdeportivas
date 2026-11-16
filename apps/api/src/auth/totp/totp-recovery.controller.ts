import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { Public } from '../decorators/public.decorator';
import { TotpRecoveryService } from './totp-recovery.service';

class TotpRecoveryRequestDto {
  @IsEmail() @MaxLength(320) email!: string;
  @IsOptional() @IsString() @Matches(/^[A-Fa-f0-9]{20}$/) recoveryCode?: string;
}
class TotpRecoveryCompleteDto { @IsString() @MinLength(32) @MaxLength(128) token!: string; }
@Controller('auth/totp/recovery')
export class TotpRecoveryController {
  constructor(private readonly recovery: TotpRecoveryService) {}
  @Public() @Post('request') @HttpCode(HttpStatus.ACCEPTED)
  async request(@Body() body: TotpRecoveryRequestDto, @Req() req: Request) {
    try { await this.recovery.request(body.email, body.recoveryCode, this.context(req)); } catch { /* Preserve the generic public recovery response. */ }
    return { message: 'Si los datos corresponden a una cuenta, se enviarán instrucciones al correo verificado.' };
  }
  @Public() @Post('complete') @HttpCode(HttpStatus.OK)
  async complete(@Body() body: TotpRecoveryCompleteDto, @Req() req: Request) {
    return this.recovery.complete(body.token, this.context(req));
  }
  private context(req: Request) { return { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) }; }
}
