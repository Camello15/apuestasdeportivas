import { BadRequestException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import {
  assertValidMatchTransition,
  shouldSuspendOpenMarkets,
} from '../src/matches/match-state-machine';

describe('MatchStateMachine', () => {
  it('permite transiciones válidas SCHEDULED -> LIVE -> FINISHED', () => {
    expect(() =>
      assertValidMatchTransition(MatchStatus.SCHEDULED, MatchStatus.LIVE),
    ).not.toThrow();
    expect(() =>
      assertValidMatchTransition(MatchStatus.LIVE, MatchStatus.FINISHED),
    ).not.toThrow();
  });

  it('rechaza transiciones inválidas como FINISHED -> LIVE o SCHEDULED -> FINISHED', () => {
    expect(() =>
      assertValidMatchTransition(MatchStatus.FINISHED, MatchStatus.LIVE),
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidMatchTransition(MatchStatus.SCHEDULED, MatchStatus.FINISHED),
    ).toThrow(BadRequestException);
  });

  it('indica cierre/suspensión de mercados abiertos al detener o finalizar partido', () => {
    expect(shouldSuspendOpenMarkets(MatchStatus.LIVE)).toBe(false);
    expect(shouldSuspendOpenMarkets(MatchStatus.SUSPENDED)).toBe(true);
    expect(shouldSuspendOpenMarkets(MatchStatus.FINISHED)).toBe(true);
    expect(shouldSuspendOpenMarkets(MatchStatus.CANCELLED)).toBe(true);
  });
});