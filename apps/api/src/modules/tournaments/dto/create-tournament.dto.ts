import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export enum TournamentFormat {
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN',
  SWISS = 'SWISS',
}

export enum BracketType {
  SOLO = 'SOLO',
  TEAM = 'TEAM',
}

export class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  gameId: string;

  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @IsEnum(BracketType)
  bracketType: BracketType;

  @IsNumber()
  @Min(1)
  @Max(10)
  teamSize: number;

  @IsNumber()
  @Min(2)
  @Max(512)
  maxParticipants: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  entryFee: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  registrationEnd?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  rules?: string;
}
