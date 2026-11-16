import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { RegisterService } from './register.service';

@Controller('auth')
export class RegisterController {
  constructor(private readonly registration: RegisterService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(@Body() body: RegisterDto, @Req() request: Request) {
    await this.registration.register(body, this.requestContext(request));
    return { message: 'Si los datos son válidos, recibirás instrucciones para verificar el correo.' };
  }

  private requestContext(request: Request) {
    return { ipAddress: request.ip, device: request.get('user-agent')?.slice(0, 512) };
  }
}
