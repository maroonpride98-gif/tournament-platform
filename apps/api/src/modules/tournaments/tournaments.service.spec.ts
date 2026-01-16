import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsService } from './tournaments.service';
import { BracketService } from './bracket.service';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    tournament: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    tournamentParticipant: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    match: {
      createMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bracket: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockBracketService = {
    generateSingleElimination: jest.fn(),
    advanceWinner: jest.fn(),
  };

  const mockEventsGateway = {
    emitParticipantUpdate: jest.fn(),
    emitTournamentStatusChange: jest.fn(),
    emitBracketUpdate: jest.fn(),
    emitMatchUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BracketService, useValue: mockBracketService },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Tournament',
      gameId: 'game-1',
      format: 'SINGLE_ELIMINATION' as const,
      bracketType: 'SOLO' as const,
      teamSize: 1,
      maxParticipants: 16,
      entryFee: 10,
      startDate: '2025-03-01T18:00:00Z',
    };

    it('should create a tournament', async () => {
      const expectedTournament = {
        id: '1',
        name: createDto.name,
        slug: 'test-tournament-123',
        status: 'REGISTRATION_OPEN',
        prizePool: 144, // 10 * 16 * 0.9
      };

      mockPrismaService.tournament.create.mockResolvedValue(expectedTournament);

      const result = await service.create(createDto, 'user-1');

      expect(result).toEqual(expectedTournament);
      expect(mockPrismaService.tournament.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated tournaments', async () => {
      const tournaments = [
        { id: '1', name: 'Tournament 1', _count: { participants: 5 } },
        { id: '2', name: 'Tournament 2', _count: { participants: 10 } },
      ];

      mockPrismaService.tournament.findMany.mockResolvedValue(tournaments);
      mockPrismaService.tournament.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a tournament by id or slug', async () => {
      const tournament = {
        id: '1',
        name: 'Test Tournament',
        slug: 'test-tournament',
        participants: [],
        matches: [],
      };

      mockPrismaService.tournament.findFirst.mockResolvedValue(tournament);

      const result = await service.findOne('test-tournament');

      expect(result).toEqual(tournament);
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockPrismaService.tournament.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('register', () => {
    it('should register a user for a tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        bracketType: 'SOLO',
        maxParticipants: 16,
        _count: { participants: 5 },
      });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue(null);
      mockPrismaService.tournamentParticipant.create.mockResolvedValue({
        id: 'participant-1',
        userId: 'user-1',
        status: 'REGISTERED',
        user: { id: 'user-1', username: 'testuser' },
      });

      const result = await service.register('1', 'user-1');

      expect(result.status).toBe('REGISTERED');
      expect(mockEventsGateway.emitParticipantUpdate).toHaveBeenCalled();
    });

    it('should throw if tournament is full', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        maxParticipants: 16,
        _count: { participants: 16 },
      });

      await expect(service.register('1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if already registered', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        maxParticipants: 16,
        _count: { participants: 5 },
      });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(service.register('1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reportScore', () => {
    it('should report match score and advance winner', async () => {
      mockPrismaService.match.findUnique.mockResolvedValue({
        id: 'match-1',
        tournamentId: '1',
        participant1Id: 'p1',
        participant2Id: 'p2',
        tournament: { id: '1' },
      });
      mockPrismaService.match.update.mockResolvedValue({
        id: 'match-1',
        score1: 3,
        score2: 1,
        winnerId: 'p1',
        status: 'COMPLETED',
      });
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        status: 'IN_PROGRESS',
      });

      const result = await service.reportScore('1', 'match-1', 3, 1, 'organizer-1');

      expect(result.score1).toBe(3);
      expect(result.score2).toBe(1);
      expect(mockBracketService.advanceWinner).toHaveBeenCalledWith('match-1', 'p1');
      expect(mockEventsGateway.emitMatchUpdate).toHaveBeenCalled();
    });
  });
});
