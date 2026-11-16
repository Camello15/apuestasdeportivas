import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { EmailSender } from './email.port';

@Injectable()
export class SmtpEmailAdapter implements EmailSender {
  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    await this.send(email, 'Restablece tu contraseña', `Usa este enlace de un solo uso para restablecer tu contraseña: ${resetUrl}`);
  }

  async sendTotpRecoveryEmail(email: string, recoveryUrl: string): Promise<void> {
    await this.send(email, 'Recuperación del autenticador', `Confirma la recuperación del autenticador desde este enlace de un solo uso: ${recoveryUrl}`);
  }

  async sendVerificationEmail(email: string, verificationUrl: string): Promise<void> {
    await this.send(email, 'Verifica tu correo electrónico', `Completa la verificación de tu correo: ${verificationUrl}`);
  }

  private async send(email: string, subject: string, text: string): Promise<void> {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT);
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.EMAIL_FROM;
    if (!host || !Number.isInteger(port) || !user || !password || !from) {
      throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE' });
    }

    const secure = process.env.SMTP_SECURE === 'true';
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass: password },
      tls: { rejectUnauthorized: true },
    });
    try {
      await transporter.sendMail({
        from,
        to: email,
        subject,
        text,
      });
    } catch {
      throw new ServiceUnavailableException({ code: 'EMAIL_UNAVAILABLE' });
    } finally {
      transporter.close();
    }
  }
}
