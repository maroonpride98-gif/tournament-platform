import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('platform') platform?: string,
    @Query('search') search?: string,
  ) {
    return this.gamesService.findAll({ category, platform, search });
  }

  @Get(':idOrSlug')
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.gamesService.findOne(idOrSlug);
  }

  @Post('seed')
  async seedGames() {
    return this.gamesService.seedGames();
  }
}
