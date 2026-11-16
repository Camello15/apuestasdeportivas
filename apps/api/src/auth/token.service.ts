import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  createRefreshToken(totpSatisfied = false): { token: string; digest: string; jti: string } {
    const token = randomBytes(48).toString('base64url');
    const assurance = totpSatisfied ? 't1' : 'p0';
    return { token, digest: this.refreshDigest(token), jti: `${assurance}.${randomUUID()}` };
  }

  refreshDigest(token: string): string {
    const pepper = process.env.REFRESH_TOKEN_PEPPER;
    if (!pepper || Buffer.byteLength(pepper) < 32) throw new ServiceUnavailableException({ code: 'AUTH_CONFIGURATION_UNAVAILABLE' });
    return createHmac('sha256', pepper).update(token).digest('hex');
  }

  createAccessToken(userId: string, sessionId: string, totpSatisfied = false): Promise<string> {
    const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const keyId = process.env.JWT_KEY_ID;
    if (!privateKey || !keyId || !process.env.JWT_ISSUER || !process.env.JWT_AUDIENCE) {
      throw new ServiceUnavailableException({ code: 'AUTH_CONFIGURATION_UNAVAILABLE' });
    }
    return this.jwt.signAsync({ sub: userId, sid: sessionId, jti: randomUUID(), totpSatisfied }, {
      algorithm: 'RS256', privateKey,
      header: { alg: 'RS256', kid: keyId, typ: 'JWT' },
      issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE,
      expiresIn: '15m',
    });
  }
}
