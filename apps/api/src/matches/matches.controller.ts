import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';
import {
  CreateCompetitionDto,
  CreateMarketDto,
  CreateMatchDto,
  TransitionMatchStatusDto,
  UpdateMarketStatusDto,
  UpdateSelectionOddsDto,
} from './dto/matches.dto';
import { MatchesService } from './matches.service';

interface AuthenticatedRequest extends Request {
  auth?: { userId?: string };
}

@Controller()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Public()
  @Get('competitions')
  listCompetitions() {
    return this.matchesService.listCompetitions();
  }

  @RequirePermissions('matches:manage')
  @Post('competitions')
  createCompetition(
    @Body() dto: CreateCompetitionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.matchesService.createCompetition(dto, req.auth?.userId);
  }

  @Public()
  @Get('matches')
  listMatches(
    @Query('status') status?: MatchStatus,
    @Query('competitionId') competitionId?: string,
  ) {
    return this.matchesService.listMatches({ status, competitionId });
  }

  @Public()
  @Get('matches/:matchId')
  getMatchById(@Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.matchesService.getMatchById(matchId);
  }

  @RequirePermissions('matches:manage')
  @Post('matches')
  createMatch(@Body() dto: CreateMatchDto, @Req() req: AuthenticatedRequest) {
    return this.matchesService.createMatch(dto, req.auth?.userId);
  }

  @RequirePermissions('matches:manage')
  @Patch('matches/:matchId/status')
  transitionMatchStatus(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: TransitionMatchStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.matchesService.transitionMatchStatus(
      matchId,
      dto,
      req.auth?.userId,
    );
  }

  @RequirePermissions('matches:manage')
  @Post('matches/:matchId/markets')
  createMarket(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: CreateMarketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.matchesService.createMarket(matchId, dto, req.auth?.userId);
  }

  @RequirePermissions('matches:manage')
  @Patch('markets/:marketId/status')
  updateMarketStatus(
    @Param('marketId', ParseUUIDPipe) marketId: string,
    @Body() dto: UpdateMarketStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.matchesService.updateMarketStatus(
      marketId,
      dto,
      req.auth?.userId,
    );
  }

  @RequirePermissions('matches:manage')
  @Patch('selections/:selectionId/odds')
  updateSelectionOdds(
    @Param('selectionId', ParseUUIDPipe) selectionId: string,
    @Body() dto: UpdateSelectionOddsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.matchesService.updateSelectionOdds(
      selectionId,
      dto,
      req.auth?.userId,
    );
  }
}