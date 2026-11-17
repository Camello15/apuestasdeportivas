import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MarketStatus, MatchStatus } from '@prisma/client';

export class CreateCompetitionDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(100)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sport?: string;
}

export class CreateMatchDto {
  @IsUUID()
  competitionId!: string;

  @IsString()
  @MaxLength(160)
  homeTeam!: string;

  @IsString()
  @MaxLength(160)
  awayTeam!: string;

  @IsDateString()
  startsAt!: string;
}

export class TransitionMatchStatusDto {
  @IsEnum(MatchStatus)
  status!: MatchStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number;
}

export class CreateSelectionDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsString()
  @MaxLength(160)
  label!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1.01)
  odds!: number;
}

export class CreateMarketDto {
  @IsString()
  @MaxLength(64)
  type!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSelectionDto)
  selections!: CreateSelectionDto[];
}

export class UpdateSelectionOddsDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1.01)
  odds!: number;
}

export class UpdateMarketStatusDto {
  @IsEnum(MarketStatus)
  status!: MarketStatus;
}