import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { publicAuthErrorCode } from '../../auth/auth-error.mapper';

@Catch()
export class AuthErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const code = publicAuthErrorCode(status, payload);

    if (status >= 500) {
      this.logger.error(JSON.stringify({ event: 'request_failed', method: request.method, path: request.path, status }));
    }

    response.status(status).json({
      statusCode: status,
      code,
      message: status >= 500 ? 'No se pudo completar la solicitud.' :
        status === 400 ? 'La solicitud contiene datos no válidos.' :
      status === 401 ? 'No se pudo autenticar la solicitud.' : status >= 500 ? 'El servicio no está disponible.' : 'La solicitud fue rechazada.',
    });
  }
}
