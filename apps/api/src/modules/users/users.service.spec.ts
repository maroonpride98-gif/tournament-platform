import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tournamentParticipant: {
      findMany: jest.fn(),
    },
    userStats: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user without password hash', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'secret-hash',
        stats: { wins: 10 },
      });

      const result = await service.findById('user-1');

      expect(result.id).toBe('user-1');
      expect(result.username).toBe('testuser');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUsername', () => {
    it('should return user by username without password hash', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'secret-hash',
        stats: {},
        teamMemberships: [],
      });

      const result = await service.findByUsername('testuser');

      expect(result.username).toBe('testuser');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByUsername('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        bio: 'New bio',
        avatar: 'new-avatar.png',
        passwordHash: 'secret',
        stats: {},
      });

      const result = await service.updateProfile('user-1', {
        bio: 'New bio',
        avatar: 'new-avatar.png',
      });

      expect(result.bio).toBe('New bio');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should update gaming IDs', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        psnId: 'player123',
        xboxGamertag: 'xplayer123',
        passwordHash: 'secret',
        stats: {},
      });

      const result = await service.updateProfile('user-1', {
        psnId: 'player123',
        xboxGamertag: 'xplayer123',
      });

      expect(result.psnId).toBe('player123');
      expect(result.xboxGamertag).toBe('xplayer123');
    });
  });

  describe('getTournamentHistory', () => {
    it('should return user tournament history', async () => {
      mockPrismaService.tournamentParticipant.findMany.mockResolvedValue([
        {
          id: 'part-1',
          tournamentId: 'tournament-1',
          tournament: { name: 'Tournament 1', game: { name: 'Game 1' } },
        },
        {
          id: 'part-2',
          tournamentId: 'tournament-2',
          tournament: { name: 'Tournament 2', game: { name: 'Game 2' } },
        },
      ]);

      const result = await service.getTournamentHistory('user-1');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.tournamentParticipant.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          tournament: {
            include: { game: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard with rankings', async () => {
      mockPrismaService.userStats.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          wins: 50,
          losses: 10,
          tournamentsWon: 5,
          totalEarnings: 1000,
          user: { id: 'user-1', username: 'pro1', avatar: null },
        },
        {
          userId: 'user-2',
          wins: 40,
          losses: 15,
          tournamentsWon: 3,
          totalEarnings: 500,
          user: { id: 'user-2', username: 'pro2', avatar: null },
        },
      ]);

      const result = await service.getLeaderboard({ page: 1, pageSize: 50 });

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].username).toBe('pro1');
      expect(result[1].rank).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.userStats.findMany.mockResolvedValue([
        {
          user: { id: 'user-51', username: 'user51', avatar: null },
          wins: 10,
          losses: 5,
          tournamentsWon: 1,
          totalEarnings: 100,
        },
      ]);

      const result = await service.getLeaderboard({ page: 2, pageSize: 50 });

      expect(result[0].rank).toBe(51); // Page 2, first entry
      expect(mockPrismaService.userStats.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 50,
        }),
      );
    });

    it('should use default pagination values', async () => {
      mockPrismaService.userStats.findMany.mockResolvedValue([]);

      await service.getLeaderboard({});

      expect(mockPrismaService.userStats.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        }),
      );
    });
  });
});
