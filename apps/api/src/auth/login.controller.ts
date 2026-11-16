import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { Public } from './decorators/public.decorator';
import { LoginService } from './login.service';

class LoginDto {
  @IsEmail() @MaxLength(320) email!: string;
  @IsString() @MinLength(15) @MaxLength(256) password!: string;
  @IsString() @MinLength(1) @MaxLength(2048) captchaToken!: string;
}
@Controller('auth')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}
  @Public() @Post('login') @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.loginService.login(body, { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) });
    if ('challengeToken' in session) return { challengeToken: session.challengeToken, requiresTotp: true };
    LoginController.setCookies(res, session);
    return { message: 'Sesión iniciada.' };
  }
  static setCookies(res: Response, session: { accessToken: string; refreshToken: string }) {
    res.cookie('access_token', session.accessToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 15 * 60_000 });
    res.cookie('refresh_token', session.refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60_000 });
  }
}
