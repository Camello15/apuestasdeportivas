import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { verify, hash } from 'argon2';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as english from '@zxcvbn-ts/language-en';
import * as spanish from '@zxcvbn-ts/language-es-es';
import { HibpClient } from '../integrations/hibp.client';

const estimator = new ZxcvbnFactory({
  translations: english.translations,
  graphs: common.adjacencyGraphs,
  dictionary: { ...common.dictionary, ...english.dictionary, ...spanish.dictionary },
});
const commonPasswords = new Set(common.dictionary['passwords-common']);

@Injectable()
export class PasswordService {
  constructor(private readonly hibp: HibpClient) {}

  async hashForRegistration(password: string): Promise<string> {
    await this.assertAllowed(password);
    return hash(password, { type: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }

  async verify(passwordHash: string, candidate: string): Promise<boolean> {
    try {
      return await verify(passwordHash, candidate);
    } catch {
      return false;
    }
  }

  async performDummyVerification(candidate: string): Promise<void> {
    await hash(candidate, { type: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }

  private async assertAllowed(password: string): Promise<void> {
    const length = Array.from(password).length;
    if (length < 15 || length > 128) {
      throw new BadRequestException({ code: 'PASSWORD_POLICY_REJECTED' });
    }
    if (commonPasswords.has(password) || estimator.check(password).score < 3) {
      throw new BadRequestException({ code: 'PASSWORD_POLICY_REJECTED' });
    }
    const digest = createHash('sha1').update(password, 'utf8').digest('hex');
    if (await this.hibp.isCompromised(digest)) {
      throw new BadRequestException({ code: 'PASSWORD_POLICY_REJECTED' });
    }
  }
}
