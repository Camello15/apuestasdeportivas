import { Module } from '@nestjs/common';
import { CAPTCHA_VERIFIER } from './captcha.port';
import { EMAIL_SENDER } from './email.port';
import { HibpClient } from './hibp.client';
import { SmtpEmailAdapter } from './smtp-email.adapter';
import { TurnstileCaptchaAdapter } from './turnstile-captcha.adapter';

@Module({
  providers: [
    HibpClient,
    SmtpEmailAdapter,
    TurnstileCaptchaAdapter,
    { provide: EMAIL_SENDER, useExisting: SmtpEmailAdapter },
    { provide: CAPTCHA_VERIFIER, useExisting: TurnstileCaptchaAdapter },
  ],
  exports: [EMAIL_SENDER, CAPTCHA_VERIFIER, HibpClient],
})
export class AuthIntegrationsModule {}
