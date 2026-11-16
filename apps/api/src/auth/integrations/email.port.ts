export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface EmailSender {
  sendVerificationEmail(email: string, verificationUrl: string): Promise<void>;
  sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>;
  sendTotpRecoveryEmail(email: string, recoveryUrl: string): Promise<void>;
}
