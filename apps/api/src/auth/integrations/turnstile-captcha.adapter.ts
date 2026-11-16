import { Injectable } from '@nestjs/common';
import { CaptchaVerifier } from './captcha.port';

type SiteverifyResponse = { success?: unknown; hostname?: unknown; action?: unknown };

@Injectable()
export class TurnstileCaptchaAdapter implements CaptchaVerifier {
  async verify(token: string, remoteIp?: string, expectedAction?: string): Promise<boolean> {
    const secret = process.env.CAPTCHA_SECRET_KEY;
    const expectedHostname = process.env.CAPTCHA_EXPECTED_HOSTNAME;
    if (!secret || !expectedHostname || !token || token.length > 2048) return false;

    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const result = await response.json() as SiteverifyResponse;
      return result.success === true && result.hostname === expectedHostname &&
        (!expectedAction || result.action === expectedAction);
    } catch {
      return false;
    }
  }
}
