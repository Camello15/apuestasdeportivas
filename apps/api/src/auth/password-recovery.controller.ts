import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { Public } from './decorators/public.decorator';
import { PasswordRecoveryService } from './password-recovery.service';
import { PasswordService } from './password/password.service';
class ForgotDto { @IsEmail() @MaxLength(320) email!: string; }
class ResetDto { @IsString() @MinLength(32) @MaxLength(128) token!: string; @IsString() @MinLength(15) @MaxLength(128) password!: string; }
@Controller('auth/password')
export class PasswordRecoveryController {
  constructor(private readonly recovery: PasswordRecoveryService, private readonly passwords: PasswordService) {}
  @Public() @Post('forgot') @HttpCode(HttpStatus.ACCEPTED)
  async forgot(@Body() body: ForgotDto, @Req() req: Request) {
    try { await this.recovery.request(body.email, this.context(req)); } catch { /* Keep this public response indistinguishable across account/provider states. */ }
    return { message: 'Si el correo corresponde a una cuenta verificada, recibirás instrucciones para restablecer la contraseña.' };
  }
  @Public() @Post('reset') @HttpCode(HttpStatus.OK)
  async reset(@Body() body: ResetDto, @Req() req: Request) {
    await this.recovery.assertResetToken(body.token);
    const hash = await this.passwords.hashForRegistration(body.password);
    await this.recovery.reset(body.token, hash, this.context(req));
    return { message: 'La contraseña se ha restablecido.' };
  }
  private context(req: Request) { return { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) }; }
}
