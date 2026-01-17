import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        stats: true,
        teamMemberships: {
          include: { team: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        stats: true,
        teamMemberships: {
          include: { team: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }

  async updateProfile(userId: string, data: {
    bio?: string;
    avatar?: string;
    psnId?: string;
    xboxGamertag?: string;
  }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: { stats: true },
    });

    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }

  async getTournamentHistory(userId: string) {
    return this.prisma.tournamentParticipant.findMany({
      where: { userId },
      include: {
        tournament: {
          include: { game: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLeaderboard(options: {
    page?: number;
    pageSize?: number;
    gameId?: string;
  }) {
    const page = Number(options.page) || 1;
    const pageSize = Number(options.pageSize) || 50;
    const skip = (page - 1) * pageSize;

    const users = await this.prisma.userStats.findMany({
      skip,
      take: pageSize,
      orderBy: [
        { tournamentsWon: 'desc' },
        { totalEarnings: 'desc' },
        { wins: 'desc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return users.map((stats, index) => ({
      rank: skip + index + 1,
      userId: stats.user.id,
      username: stats.user.username,
      avatar: stats.user.avatar,
      wins: stats.wins,
      losses: stats.losses,
      tournamentsWon: stats.tournamentsWon,
      earnings: stats.totalEarnings,
    }));
  }
}
