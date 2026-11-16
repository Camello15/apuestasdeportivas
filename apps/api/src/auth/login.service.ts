import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { UsersService, normalizeEmail } from '../users/users.service';
import { PasswordService } from './password/password.service';
import { CaptchaVerifier, CAPTCHA_VERIFIER } from './integrations/captcha.port';
import { AttemptCounterService } from './abuse/attempt-counter.service';
import { AuditService } from '../audit/audit.service';
import { SessionService } from './session.service';
import { PreAuthChallengeService } from './totp/pre-auth-challenge.service';

const invalid = () => new UnauthorizedException({ code: 'AUTHENTICATION_FAILED' });
@Injectable()
export class LoginService {
  constructor(private readonly users: UsersService, private readonly passwords: PasswordService,
    private readonly limits: AttemptCounterService, private readonly sessions: SessionService,
    private readonly audit: AuditService, @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
    private readonly prisma: PrismaService, private readonly challenges: PreAuthChallengeService) {}

  async login(input: { email: string; password: string; captchaToken: string }, context: { ipAddress?: string; device?: string }) {
    if (!context.ipAddress || !await this.limits.checkIpAttempt(context.ipAddress)) {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'login_ip_rate_limited', ...context });
      throw invalid();
    }
    if (!await this.captcha.verify(input.captchaToken, context.ipAddress, 'login')) {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'login_captcha_denied', ...context });
      throw invalid();
    }
    const normalized = normalizeEmail(input.email);
    const accountKey = createHash('sha256').update(normalized).digest('hex');
    if (await this.limits.isPasswordBlocked(accountKey)) {
      await this.audit.append({ actorType: 'ANONYMOUS', action: 'login_account_blocked', ...context });
      throw invalid();
    }
    const user = await this.users.findByNormalizedEmail(normalized);
    if (!user) await this.passwords.performDummyVerification(input.password);
    const valid = Boolean(user && await this.passwords.verify(user.passwordHash, input.password));
    if (!valid || !user) {
      await this.limits.recordPasswordFailure(accountKey);
      await this.audit.append({ actorId: user?.id, actorType: user ? 'USER' : 'ANONYMOUS', action: 'login_failed', ...context, targetType: user ? 'user' : undefined, targetId: user?.id });
      throw invalid();
    }
    if (user.status !== 'ACTIVE' || !user.emailVerifiedAt) {
      await this.audit.append({ actorId: user.id, actorType: 'USER', action: 'login_unverified_denied', ...context, targetType: 'user', targetId: user.id });
      throw invalid();
    }
    const totp = await this.prisma.totpCredential.findUnique({ where: { userId: user.id }, select: { enabledAt: true } });
    if (totp?.enabledAt) {
      const challengeToken = await this.challenges.issue(user.id);
      try { await this.audit.append({ actorId: user.id, actorType: 'USER', action: 'totp_login_challenge_issued', ...context, targetType: 'user', targetId: user.id }); }
      catch (error) { await this.challenges.remove(challengeToken).catch(() => undefined); throw error; }
      return { challengeToken };
    }
    await this.limits.resetPasswordFailures(accountKey);
    return this.sessions.create(user.id, context, false);
  }
}
