import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TeamsService', () => {
  let service: TeamsService;

  const mockPrismaService = {
    team: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    teamMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a team with captain as first member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);
      mockPrismaService.team.create.mockResolvedValue({
        id: 'team-1',
        name: 'Test Team',
        tag: 'TEST',
        captainId: 'user-1',
        members: [{ userId: 'user-1', role: 'CAPTAIN' }],
      });

      const result = await service.create(
        { name: 'Test Team', tag: 'test', gameId: 'game-1' },
        'user-1',
      );

      expect(result.tag).toBe('TEST');
      expect(mockPrismaService.team.create).toHaveBeenCalled();
    });

    it('should throw if tag is already taken', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'existing',
        tag: 'TEST',
      });

      await expect(
        service.create({ name: 'New Team', tag: 'test', gameId: 'game-1' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should uppercase the tag', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);
      mockPrismaService.team.create.mockResolvedValue({
        id: 'team-1',
        tag: 'LOWERCASE',
      });

      await service.create(
        { name: 'Team', tag: 'lowercase', gameId: 'game-1' },
        'user-1',
      );

      expect(mockPrismaService.team.findUnique).toHaveBeenCalledWith({
        where: { tag: 'LOWERCASE' },
      });
    });
  });

  describe('findAll', () => {
    it('should return all teams', async () => {
      mockPrismaService.team.findMany.mockResolvedValue([
        { id: 'team-1', name: 'Team 1' },
        { id: 'team-2', name: 'Team 2' },
      ]);

      const result = await service.findAll({});

      expect(result).toHaveLength(2);
    });

    it('should filter by gameId', async () => {
      mockPrismaService.team.findMany.mockResolvedValue([]);

      await service.findAll({ gameId: 'game-1' });

      expect(mockPrismaService.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { gameId: 'game-1' },
        }),
      );
    });

    it('should filter by search term', async () => {
      mockPrismaService.team.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'test' });

      expect(mockPrismaService.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'test', mode: 'insensitive' } },
              { tag: { contains: 'test', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return team by id', async () => {
      mockPrismaService.team.findFirst.mockResolvedValue({
        id: 'team-1',
        name: 'Test Team',
      });

      const result = await service.findOne('team-1');

      expect(result.id).toBe('team-1');
    });

    it('should return team by tag', async () => {
      mockPrismaService.team.findFirst.mockResolvedValue({
        id: 'team-1',
        tag: 'TEST',
      });

      const result = await service.findOne('test');

      expect(mockPrismaService.team.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: 'test' }, { tag: 'TEST' }],
          },
        }),
      );
    });

    it('should throw if team not found', async () => {
      mockPrismaService.team.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addMember', () => {
    it('should add member to team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
      });
      mockPrismaService.teamMember.findUnique.mockResolvedValue(null);
      mockPrismaService.teamMember.create.mockResolvedValue({
        teamId: 'team-1',
        userId: 'new-user',
        role: 'MEMBER',
      });

      const result = await service.addMember('team-1', 'new-user', 'captain-1');

      expect(result.role).toBe('MEMBER');
    });

    it('should throw if team not found', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('non-existent', 'user-1', 'captain-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if requester is not captain', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
      });

      await expect(
        service.addMember('team-1', 'user-1', 'not-captain'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user is already a member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
      });
      mockPrismaService.teamMember.findUnique.mockResolvedValue({
        teamId: 'team-1',
        userId: 'user-1',
      });

      await expect(
        service.addMember('team-1', 'user-1', 'captain-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    it('should allow captain to remove member', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
      });
      mockPrismaService.teamMember.delete.mockResolvedValue({});

      await service.removeMember('team-1', 'member-1', 'captain-1');

      expect(mockPrismaService.teamMember.delete).toHaveBeenCalled();
    });

    it('should allow member to remove themselves', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
      });
      mockPrismaService.teamMember.delete.mockResolvedValue({});

      await service.removeMember('team-1', 'member-1', 'member-1');

      expect(mockPrismaService.teamMember.delete).toHaveBeenCalled();
    });

    it('should throw if team not found', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('non-existent', 'user-1', 'captain-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if not authorized', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
      });

      await expect(
        service.removeMember('team-1', 'member-1', 'random-user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if trying to remove captain', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
      });

      await expect(
        service.removeMember('team-1', 'captain-1', 'captain-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
