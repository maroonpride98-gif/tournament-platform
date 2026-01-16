import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() data: {
      name: string;
      tag: string;
      gameId: string;
      description?: string;
    },
    @Request() req: any,
  ) {
    return this.teamsService.create(data, req.user.id);
  }

  @Get()
  async findAll(
    @Query('gameId') gameId?: string,
    @Query('search') search?: string,
  ) {
    return this.teamsService.findAll({ gameId, search });
  }

  @Get(':idOrTag')
  async findOne(@Param('idOrTag') idOrTag: string) {
    return this.teamsService.findOne(idOrTag);
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard)
  async addMember(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Request() req: any,
  ) {
    return this.teamsService.addMember(id, userId, req.user.id);
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.teamsService.removeMember(id, userId, req.user.id);
  }
}
