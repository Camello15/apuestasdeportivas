import { Inject, Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { UsersService, normalizeEmail } from '../users/users.service';
import { CaptchaVerifier, CAPTCHA_VERIFIER } from './integrations/captcha.port';
import { PasswordService } from './password/password.service';
import { EmailVerificationService } from './email-verification.service';

const VERIFY_TOKEN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RegisterService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly verification: EmailVerificationService,
    private readonly audit: AuditService,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
  ) {}

  async register(input: { email: string; password: string; ageDeclared: boolean; captchaToken: string }, context: { ipAddress?: string; device?: string }): Promise<void> {
    if (!await this.captcha.verify(input.captchaToken, context.ipAddress, 'register')) {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'registration_captcha_denied', ...context });
      throw new BadRequestException({ code: 'REGISTRATION_REJECTED' });
    }
    if (input.ageDeclared !== true) {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'registration_age_denied', ...context });
      throw new BadRequestException({ code: 'REGISTRATION_REJECTED' });
    }

    const email = input.email.trim();
    const normalizedEmail = normalizeEmail(email);
    // Apply the same policy checks and Argon2 work regardless of whether the
    // normalized address is already registered, so password errors cannot be
    // used as an account-existence oracle.
    const passwordHash = await this.passwords.hashForRegistration(input.password);
    if (await this.users.findByNormalizedEmail(normalizedEmail)) {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'registration_duplicate_denied', ...context });
      return;
    }

    const rawToken = randomBytes(32).toString('base64url');
    let user;
    try {
      user = await this.users.createPendingAccount({
        email, normalizedEmail, passwordHash,
        emailTokenDigest: this.digest(rawToken),
        emailTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_MS),
        ...context,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.audit.append({ actorType: 'ANONYMOUS', action: 'registration_duplicate_denied', ...context });
        return;
      }
      throw error;
    }

    try {
      await this.verification.sendInitialVerification(user, rawToken, context.ipAddress, context.device);
    } catch (error) {
      // A delivery outage must not reveal that the address was new. The
      // verification token is invalidated by the sender service on failure;
      // the user can request another after the mail service recovers.
      if (error instanceof ServiceUnavailableException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'code' in response && response.code === 'EMAIL_UNAVAILABLE') return;
      }
      throw error;
    }
  }

  async resendVerification(email: string, context: { ipAddress?: string; device?: string }): Promise<void> {
    try {
      await this.verification.resend(email, context.ipAddress, context.device);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return;
      throw error;
    }
    await this.audit.append({ actorType: 'ANONYMOUS', action: 'email_verification_resend_requested', ...context });
  }

  async verifyEmail(token: string, context: { ipAddress?: string; device?: string }): Promise<void> {
    await this.verification.verify(token, context.ipAddress, context.device);
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
