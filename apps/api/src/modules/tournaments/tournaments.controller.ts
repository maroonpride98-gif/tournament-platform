import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateTournamentDto, @Request() req: any) {
    return this.tournamentsService.create(dto, req.user.id);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('gameId') gameId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.tournamentsService.findAll({
      page,
      pageSize,
      gameId,
      status,
      search,
    });
  }

  @Get(':idOrSlug')
  async findOne(@Param('idOrSlug') idOrSlug: string): Promise<any> {
    return this.tournamentsService.findOne(idOrSlug);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  async register(
    @Param('id') id: string,
    @Body('teamId') teamId: string | undefined,
    @Request() req: any,
  ): Promise<any> {
    return this.tournamentsService.register(id, req.user.id, teamId);
  }

  @Post(':id/check-in')
  @UseGuards(JwtAuthGuard)
  async checkIn(@Param('id') id: string, @Request() req: any): Promise<any> {
    return this.tournamentsService.checkIn(id, req.user.id);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  async start(@Param('id') id: string, @Request() req: any): Promise<any> {
    return this.tournamentsService.startTournament(id, req.user.id);
  }

  @Post(':id/matches/:matchId/score')
  @UseGuards(JwtAuthGuard)
  async reportScore(
    @Param('id') tournamentId: string,
    @Param('matchId') matchId: string,
    @Body('score1') score1: number,
    @Body('score2') score2: number,
    @Request() req: any,
  ): Promise<any> {
    return this.tournamentsService.reportScore(
      tournamentId,
      matchId,
      score1,
      score2,
      req.user.id,
    );
  }
}
