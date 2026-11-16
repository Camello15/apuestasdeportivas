import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from './decorators/public.decorator';
import { ResendEmailVerificationDto, VerifyEmailDto } from './dto/register.dto';
import { RegisterService } from './register.service';

@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly registration: RegisterService) {}

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() body: VerifyEmailDto, @Req() request: Request) {
    await this.registration.verifyEmail(body.token, this.requestContext(request));
    return { message: 'Correo verificado.' };
  }

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resend(@Body() body: ResendEmailVerificationDto, @Req() request: Request) {
    await this.registration.resendVerification(body.email, this.requestContext(request));
    return { message: 'Si existe una cuenta pendiente de verificación, se enviarán instrucciones al correo registrado.' };
  }

  private requestContext(request: Request) {
    return { ipAddress: request.ip, device: request.get('user-agent')?.slice(0, 512) };
  }
}
