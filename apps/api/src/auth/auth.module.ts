import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthIntegrationsModule } from './integrations/auth-integrations.module';
import { RegisterController } from './register.controller';
import { EmailVerificationController } from './email-verification.controller';
import { RegisterService } from './register.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password/password.service';
import { UsersModule } from '../users/users.module';
import { AttemptCounterService } from './abuse/attempt-counter.service';
import { LoginController } from './login.controller';
import { SessionController } from './session.controller';
import { LoginService } from './login.service';
import { SessionService } from './session.service';
import { SessionRevocationService } from './session-revocation.service';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';
import { TokenService } from './token.service';
import { TotpController } from './totp/totp.controller';
import { TotpService } from './totp/totp.service';
import { TotpCryptoService } from './totp/totp-crypto.service';
import { PreAuthChallengeService } from './totp/pre-auth-challenge.service';
import { TotpRecoveryService } from './totp/totp-recovery.service';
import { TotpRecoveryController } from './totp/totp-recovery.controller';
import { AdminSessionsController } from './admin-sessions.controller';

@Module({
  imports: [JwtModule.register({}), UsersModule, AuthIntegrationsModule],
  controllers: [RegisterController, EmailVerificationController, LoginController, SessionController, PasswordRecoveryController, TotpController, TotpRecoveryController, AdminSessionsController],
  providers: [RegisterService, EmailVerificationService, PasswordService, AttemptCounterService, LoginService, SessionService, SessionRevocationService, PasswordRecoveryService, TokenService, TotpService, TotpCryptoService, PreAuthChallengeService, TotpRecoveryService],
  exports: [JwtModule, SessionRevocationService, SessionService],
})
export class AuthModule {}
