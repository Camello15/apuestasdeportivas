import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service';
@Injectable()
export class SessionRevocationService {
  constructor(private readonly sessions: SessionService) {}
  revokeAll(userId: string, reason: string, context: { ipAddress?: string; device?: string } = {}) {
    return this.sessions.revokeAll(userId, reason, context);
  }
}
