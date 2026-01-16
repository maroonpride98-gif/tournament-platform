import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    tag: string;
    gameId: string;
    description?: string;
  }, userId: string) {
    // Check if tag is taken
    const existingTag = await this.prisma.team.findUnique({
      where: { tag: data.tag.toUpperCase() },
    });

    if (existingTag) {
      throw new BadRequestException('Team tag is already taken');
    }

    const team = await this.prisma.team.create({
      data: {
        name: data.name,
        tag: data.tag.toUpperCase(),
        gameId: data.gameId,
        description: data.description,
        captainId: userId,
        members: {
          create: {
            userId,
            role: 'CAPTAIN',
          },
        },
      },
      include: {
        game: true,
        captain: {
          select: { id: true, username: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    return team;
  }

  async findAll(options: { gameId?: string; search?: string }) {
    const { gameId, search } = options;

    const where: any = {};

    if (gameId) {
      where.gameId = gameId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { tag: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.team.findMany({
      where,
      include: {
        game: true,
        captain: {
          select: { id: true, username: true, avatar: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(idOrTag: string) {
    const team = await this.prisma.team.findFirst({
      where: {
        OR: [{ id: idOrTag }, { tag: idOrTag.toUpperCase() }],
      },
      include: {
        game: true,
        captain: {
          select: { id: true, username: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
        participations: {
          include: {
            tournament: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  async addMember(teamId: string, userId: string, requesterId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== requesterId) {
      throw new BadRequestException('Only the captain can add members');
    }

    // Check if user is already a member
    const existing = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (existing) {
      throw new BadRequestException('User is already a team member');
    }

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: 'MEMBER',
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });
  }

  async removeMember(teamId: string, userId: string, requesterId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.captainId !== requesterId && userId !== requesterId) {
      throw new BadRequestException('Not authorized to remove this member');
    }

    if (userId === team.captainId) {
      throw new BadRequestException('Captain cannot be removed');
    }

    return this.prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId },
      },
    });
  }
}
