import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('gameId') gameId?: string,
  ) {
    return this.usersService.getLeaderboard({ page, pageSize, gameId });
  }

  @Get(':username')
  async findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Get(':username/tournaments')
  async getTournamentHistory(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    return this.usersService.getTournamentHistory(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: any,
    @Body() data: {
      bio?: string;
      avatar?: string;
      psnId?: string;
      xboxGamertag?: string;
    },
  ) {
    return this.usersService.updateProfile(req.user.id, data);
  }
}
