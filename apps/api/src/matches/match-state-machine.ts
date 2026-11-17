import { BadRequestException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  [MatchStatus.SCHEDULED]: [
    MatchStatus.LIVE,
    MatchStatus.POSTPONED,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.LIVE]: [
    MatchStatus.FINISHED,
    MatchStatus.SUSPENDED,
  ],
  [MatchStatus.SUSPENDED]: [
    MatchStatus.LIVE,
    MatchStatus.POSTPONED,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.POSTPONED]: [
    MatchStatus.SCHEDULED,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.FINISHED]: [],
  [MatchStatus.CANCELLED]: [],
};

export function assertValidMatchTransition(
  current: MatchStatus,
  next: MatchStatus,
): void {
  if (current === next) {
    return;
  }
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new BadRequestException(
      `Transición de estado inválida: ${current} -> ${next}`,
    );
  }
}

export function shouldSuspendOpenMarkets(status: MatchStatus): boolean {
  return (
    status === MatchStatus.FINISHED ||
    status === MatchStatus.SUSPENDED ||
    status === MatchStatus.POSTPONED ||
    status === MatchStatus.CANCELLED
  );
}