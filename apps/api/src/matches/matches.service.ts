import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditActorType,
  MarketStatus,
  MatchStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  assertValidMatchTransition,
  shouldSuspendOpenMarkets,
} from './match-state-machine';
import {
  CreateCompetitionDto,
  CreateMarketDto,
  CreateMatchDto,
  TransitionMatchStatusDto,
  UpdateMarketStatusDto,
  UpdateSelectionOddsDto,
} from './dto/matches.dto';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listCompetitions() {
    return this.prisma.competition.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCompetition(dto: CreateCompetitionDto, actorId?: string) {
    const competition = await this.prisma.competition.create({
      data: {
        name: dto.name.trim(),
        country: dto.country.trim(),
        sport: dto.sport?.trim() ?? 'FOOTBALL',
      },
    });

    await this.audit.append({
      actorId,
      actorType: AuditActorType.ADMINISTRATOR,
      action: 'COMPETITION_CREATED',
      targetType: 'Competition',
      targetId: competition.id,
      metadata: { name: competition.name, country: competition.country },
    });

    return competition;
  }

  async listMatches(filters?: { status?: MatchStatus; competitionId?: string }) {
    return this.prisma.match.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.competitionId
          ? { competitionId: filters.competitionId }
          : {}),
      },
      include: {
        competition: true,
        markets: {
          include: {
            selections: {
              orderBy: { code: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async getMatchById(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        competition: true,
        markets: {
          include: {
            selections: {
              orderBy: { code: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    return match;
  }

  async createMatch(dto: CreateMatchDto, actorId?: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id: dto.competitionId },
    });
    if (!competition) {
      throw new NotFoundException('Competición no encontrada');
    }

    if (dto.homeTeam.trim().toLowerCase() === dto.awayTeam.trim().toLowerCase()) {
      throw new BadRequestException(
        'El equipo local y visitante no pueden ser iguales',
      );
    }

    const match = await this.prisma.match.create({
      data: {
        competitionId: dto.competitionId,
        homeTeam: dto.homeTeam.trim(),
        awayTeam: dto.awayTeam.trim(),
        startsAt: new Date(dto.startsAt),
      },
      include: { competition: true },
    });

    await this.audit.append({
      actorId,
      actorType: AuditActorType.ADMINISTRATOR,
      action: 'MATCH_CREATED',
      targetType: 'Match',
      targetId: match.id,
      metadata: {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        startsAt: match.startsAt.toISOString(),
      },
    });

    return match;
  }

  async transitionMatchStatus(
    matchId: string,
    dto: TransitionMatchStatusDto,
    actorId?: string,
  ) {
    const existing = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!existing) {
      throw new NotFoundException('Partido no encontrado');
    }

    assertValidMatchTransition(existing.status, dto.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id: matchId },
        data: {
          status: dto.status,
          ...(dto.homeScore !== undefined ? { homeScore: dto.homeScore } : {}),
          ...(dto.awayScore !== undefined ? { awayScore: dto.awayScore } : {}),
        },
      });

      if (shouldSuspendOpenMarkets(dto.status)) {
        const targetMarketStatus =
          dto.status === MatchStatus.CANCELLED
            ? MarketStatus.VOID
            : dto.status === MatchStatus.FINISHED
              ? MarketStatus.CLOSED
              : MarketStatus.SUSPENDED;

        await tx.market.updateMany({
          where: {
            matchId,
            status: MarketStatus.OPEN,
          },
          data: { status: targetMarketStatus },
        });
      }

      return match;
    });

    await this.audit.append({
      actorId,
      actorType: AuditActorType.ADMINISTRATOR,
      action: 'MATCH_STATUS_TRANSITIONED',
      targetType: 'Match',
      targetId: matchId,
      metadata: {
        from: existing.status,
        to: dto.status,
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
      },
    });

    return this.getMatchById(matchId);
  }

  async createMarket(matchId: string, dto: CreateMarketDto, actorId?: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (
      match.status === MatchStatus.FINISHED ||
      match.status === MatchStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'No se pueden agregar mercados a un partido finalizado o cancelado',
      );
    }

    if (!dto.selections || dto.selections.length < 2) {
      throw new BadRequestException(
        'Un mercado debe tener al menos dos selecciones',
      );
    }

    const market = await this.prisma.market.create({
      data: {
        matchId,
        type: dto.type.trim(),
        name: dto.name.trim(),
        selections: {
          create: dto.selections.map((sel) => ({
            code: sel.code.trim().toUpperCase(),
            label: sel.label.trim(),
            odds: new Prisma.Decimal(sel.odds.toFixed(2)),
          })),
        },
      },
      include: { selections: true },
    });

    await this.audit.append({
      actorId,
      actorType: AuditActorType.ADMINISTRATOR,
      action: 'MARKET_CREATED',
      targetType: 'Market',
      targetId: market.id,
      metadata: { matchId, type: market.type, name: market.name },
    });

    return market;
  }

  async updateMarketStatus(
    marketId: string,
    dto: UpdateMarketStatusDto,
    actorId?: string,
  ) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
    });
    if (!market) {
      throw new NotFoundException('Mercado no encontrado');
    }

    const updated = await this.prisma.market.update({
      where: { id: marketId },
      data: { status: dto.status },
      include: { selections: true },
    });

    await this.audit.append({
      actorId,
      actorType: AuditActorType.ADMINISTRATOR,
      action: 'MARKET_STATUS_UPDATED',
      targetType: 'Market',
      targetId: marketId,
      metadata: { from: market.status, to: dto.status },
    });

    return updated;
  }

  async updateSelectionOdds(
    selectionId: string,
    dto: UpdateSelectionOddsDto,
    actorId?: string,
  ) {
    const selection = await this.prisma.selection.findUnique({
      where: { id: selectionId },
      include: { market: true },
    });
    if (!selection) {
      throw new NotFoundException('Selección no encontrada');
    }

    const updated = await this.prisma.selection.update({
      where: { id: selectionId },
      data: { odds: new Prisma.Decimal(dto.odds.toFixed(2)) },
    });

    await this.audit.append({
      actorId,
      actorType: AuditActorType.ADMINISTRATOR,
      action: 'SELECTION_ODDS_UPDATED',
      targetType: 'Selection',
      targetId: selectionId,
      metadata: {
        previousOdds: selection.odds.toString(),
        newOdds: updated.odds.toString(),
      },
    });

    return updated;
  }
}
