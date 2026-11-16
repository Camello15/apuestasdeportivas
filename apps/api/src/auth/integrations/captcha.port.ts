export const CAPTCHA_VERIFIER = Symbol('CAPTCHA_VERIFIER');

export interface CaptchaVerifier {
  verify(token: string, remoteIp?: string, expectedAction?: string): Promise<boolean>;
}
