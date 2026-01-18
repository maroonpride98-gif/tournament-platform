import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BracketService } from './bracket.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { PLATFORM_FEES } from 'shared';

@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    private bracketService: BracketService,
    private eventsGateway: EventsGateway,
  ) {}

  async create(dto: CreateTournamentDto, userId: string) {
    // Generate slug from name
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);

    // Calculate platform fee
    const platformFee = dto.entryFee * PLATFORM_FEES.FREE_TIER;

    const tournament = await this.prisma.tournament.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        gameId: dto.gameId,
        format: dto.format,
        bracketType: dto.bracketType,
        teamSize: dto.teamSize,
        maxParticipants: dto.maxParticipants,
        entryFee: dto.entryFee,
        prizePool: 0, // Prize pool grows as participants pay entry fees
        platformFee,
        rules: dto.rules,
        startDate: new Date(dto.startDate),
        registrationEnd: dto.registrationEnd ? new Date(dto.registrationEnd) : null,
        status: 'REGISTRATION_OPEN',
        createdById: userId,
      },
      include: {
        game: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return tournament;
  }

  async findAll(options: {
    page?: number;
    pageSize?: number;
    gameId?: string;
    status?: string;
    search?: string;
  }) {
    const page = Number(options.page) || 1;
    const pageSize = Number(options.pageSize) || 10;
    const { gameId, status, search } = options;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (gameId) {
      where.gameId = gameId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [tournaments, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { startDate: 'asc' },
        include: {
          game: true,
          createdBy: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          _count: {
            select: { participants: true },
          },
        },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      items: tournaments.map((t) => ({
        ...t,
        currentParticipants: t._count.participants,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(idOrSlug: string): Promise<any> {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        game: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            team: true,
          },
        },
        matches: {
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
        bracket: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return tournament;
  }

  async register(tournamentId: string, userId: string, teamId?: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { participants: true } },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new BadRequestException('Registration is not open');
    }

    if (tournament._count.participants >= tournament.maxParticipants) {
      throw new BadRequestException('Tournament is full');
    }

    // Check if already registered
    const existing = await this.prisma.tournamentParticipant.findFirst({
      where: {
        tournamentId,
        OR: [{ userId }, { teamId: teamId || undefined }],
      },
    });

    if (existing) {
      throw new BadRequestException('Already registered for this tournament');
    }

    const participant = await this.prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        userId: tournament.bracketType === 'SOLO' ? userId : null,
        teamId: tournament.bracketType === 'TEAM' ? teamId : null,
        status: 'REGISTERED',
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        team: true,
      },
    });

    // Emit real-time update
    this.eventsGateway.emitParticipantUpdate(tournamentId, {
      action: 'joined',
      participant,
      count: tournament._count.participants + 1,
    });

    return participant;
  }

  async checkIn(tournamentId: string, userId: string): Promise<any> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new BadRequestException('Tournament is not open for check-in');
    }

    // Find participant
    const participant = await this.prisma.tournamentParticipant.findFirst({
      where: {
        tournamentId,
        userId,
      },
    });

    if (!participant) {
      throw new BadRequestException('You are not registered for this tournament');
    }

    if (participant.status === 'CHECKED_IN') {
      throw new BadRequestException('You have already checked in');
    }

    // Update participant status to checked in
    const updated = await this.prisma.tournamentParticipant.update({
      where: { id: participant.id },
      data: { status: 'CHECKED_IN' },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        team: true,
      },
    });

    // Emit real-time update
    this.eventsGateway.emitParticipantUpdate(tournamentId, {
      action: 'checked_in',
      participant: updated,
    });

    return updated;
  }

  async startTournament(tournamentId: string, userId: string): Promise<any> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          where: { status: 'CHECKED_IN' },
          include: {
            user: { select: { id: true, username: true } },
            team: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.createdById !== userId) {
      throw new BadRequestException('Only the organizer can start the tournament');
    }

    if (tournament.participants.length < 2) {
      throw new BadRequestException('Need at least 2 participants to start');
    }

    // Generate bracket based on tournament format
    let matches: any[];
    let bracketData: any;

    if (tournament.format === 'DOUBLE_ELIMINATION') {
      const result = this.bracketService.generateDoubleElimination(tournament.participants);
      matches = result.matches;
      bracketData = result.bracketData;
    } else {
      // Default to single elimination for SINGLE_ELIMINATION, ROUND_ROBIN, SWISS
      const result = this.bracketService.generateSingleElimination(tournament.participants);
      matches = result.matches;
      bracketData = result.bracketData;
    }

    // Create matches and bracket in database
    await this.prisma.$transaction([
      this.prisma.match.createMany({
        data: matches.map((m) => ({
          ...m,
          tournamentId,
        })),
      }),
      this.prisma.bracket.create({
        data: {
          tournamentId,
          bracketData,
        },
      }),
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'IN_PROGRESS' },
      }),
    ]);

    // Emit real-time updates
    this.eventsGateway.emitTournamentStatusChange(tournamentId, 'IN_PROGRESS');
    this.eventsGateway.emitBracketUpdate(tournamentId, { bracketData, matches });

    return this.findOne(tournamentId);
  }

  async reportScore(
    tournamentId: string,
    matchId: string,
    score1: number,
    score2: number,
    _userId: string,
  ): Promise<any> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.tournamentId !== tournamentId) {
      throw new BadRequestException('Match does not belong to this tournament');
    }

    // Determine winner
    const winnerId = score1 > score2 ? match.participant1Id : match.participant2Id;

    // Update match
    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        winnerId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Advance winner to next round
    await this.bracketService.advanceWinner(matchId, winnerId!);

    // Emit real-time match update
    this.eventsGateway.emitMatchUpdate(tournamentId, matchId, {
      score1,
      score2,
      winnerId,
      status: 'COMPLETED',
    });

    // Check if tournament is complete
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (tournament?.status === 'COMPLETED') {
      this.eventsGateway.emitTournamentStatusChange(tournamentId, 'COMPLETED');
    }

    return updatedMatch;
  }
}
