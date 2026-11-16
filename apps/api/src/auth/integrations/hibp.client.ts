import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class HibpClient {
  private readonly timeoutMs = 3000;
  private readonly maxRetries = 1;

  async isCompromised(fullSha1Hex: string): Promise<boolean> {
    if (!/^[A-Fa-f0-9]{40}$/.test(fullSha1Hex)) throw new Error('Invalid local SHA-1 digest');
    const normalizedHash = fullSha1Hex.toUpperCase();
    const prefix = normalizedHash.slice(0, 5);
    const suffix = normalizedHash.slice(5);

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
          headers: { 'Add-Padding': 'true', 'User-Agent': 'apuestasdeportivas-academic-auth' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch {
        if (attempt < this.maxRetries) continue;
        throw new ServiceUnavailableException({ code: 'PASSWORD_CHECK_UNAVAILABLE' });
      }

      if (response.status >= 500 && attempt < this.maxRetries) continue;
      if (!response.ok) throw new ServiceUnavailableException({ code: 'PASSWORD_CHECK_UNAVAILABLE' });

      let body: string;
      try {
        body = await response.text();
      } catch {
        if (attempt < this.maxRetries) continue;
        throw new ServiceUnavailableException({ code: 'PASSWORD_CHECK_UNAVAILABLE' });
      }

      const entries = body.split(/\r?\n/).filter(Boolean);
      let count = 0;
      for (const entry of entries) {
        const match = /^([A-Fa-f0-9]{35}):([0-9]+)$/.exec(entry);
        if (!match) throw new ServiceUnavailableException({ code: 'PASSWORD_CHECK_UNAVAILABLE' });
        if (match[1].toUpperCase() === suffix) count = Number(match[2]);
      }
      if (!Number.isSafeInteger(count)) throw new ServiceUnavailableException({ code: 'PASSWORD_CHECK_UNAVAILABLE' });
      return count > 0;
    }
    throw new ServiceUnavailableException({ code: 'PASSWORD_CHECK_UNAVAILABLE' });
  }
}
