import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class TotpCryptoService {
  private key(version = this.keyVersion()): Buffer {
    let encoded: string | undefined;
    if (process.env.TOTP_ENCRYPTION_KEYS) {
      try { encoded = (JSON.parse(process.env.TOTP_ENCRYPTION_KEYS) as Record<string, unknown>)[version] as string | undefined; }
      catch { throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' }); }
    }
    if (!encoded && version === this.keyVersion()) encoded = process.env.TOTP_ENCRYPTION_KEY;
    if (!encoded) throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' });
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' });
    return key;
  }
  keyVersion(): string {
    const version = process.env.TOTP_KEY_VERSION;
    if (!version || !/^[A-Za-z0-9_-]{1,64}$/.test(version)) throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' });
    return version;
  }
  encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.');
  }
  decrypt(payload: string, version: string): string {
    try {
      const [iv, tag, ciphertext] = payload.split('.').map(part => Buffer.from(part, 'base64url'));
      if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) throw new Error('invalid ciphertext');
      const decipher = createDecipheriv('aes-256-gcm', this.key(version), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch { throw new ServiceUnavailableException({ code: 'TOTP_UNAVAILABLE' }); }
  }
}
