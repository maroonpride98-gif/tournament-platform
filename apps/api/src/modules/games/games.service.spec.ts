import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('GamesService', () => {
  let service: GamesService;

  const mockPrismaService = {
    game: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all active games', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([
        { id: 'game-1', name: 'FIFA 25', isActive: true },
        { id: 'game-2', name: 'COD Warzone', isActive: true },
      ]);

      const result = await service.findAll({});

      expect(result).toHaveLength(2);
      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by category', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.findAll({ category: 'SPORTS' });

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'SPORTS' },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by platform', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.findAll({ platform: 'PS5' });

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: { isActive: true, platform: { has: 'PS5' } },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by search term', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.findAll({ search: 'fifa' });

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          name: { contains: 'fifa', mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should combine multiple filters', async () => {
      mockPrismaService.game.findMany.mockResolvedValue([]);

      await service.findAll({
        category: 'SPORTS',
        platform: 'PS5',
        search: 'fifa',
      });

      expect(mockPrismaService.game.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          category: 'SPORTS',
          platform: { has: 'PS5' },
          name: { contains: 'fifa', mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return game by id', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({
        id: 'game-1',
        name: 'FIFA 25',
        slug: 'fifa-25',
        _count: { tournaments: 5 },
      });

      const result = await service.findOne('game-1');

      expect(result.id).toBe('game-1');
      expect(result._count.tournaments).toBe(5);
    });

    it('should return game by slug', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue({
        id: 'game-1',
        slug: 'cod-warzone',
      });

      await service.findOne('cod-warzone');

      expect(mockPrismaService.game.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'cod-warzone' }, { slug: 'cod-warzone' }],
        },
        include: {
          _count: {
            select: { tournaments: true },
          },
        },
      });
    });

    it('should throw if game not found', async () => {
      mockPrismaService.game.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new game', async () => {
      mockPrismaService.game.create.mockResolvedValue({
        id: 'game-1',
        name: 'New Game',
        slug: 'new-game',
        platform: ['PS5', 'XBOX'],
        category: 'FIGHTING',
      });

      const result = await service.create({
        name: 'New Game',
        slug: 'new-game',
        platform: ['PS5', 'XBOX'],
        category: 'FIGHTING',
      });

      expect(result.name).toBe('New Game');
      expect(result.platform).toEqual(['PS5', 'XBOX']);
    });

    it('should include optional fields', async () => {
      mockPrismaService.game.create.mockResolvedValue({
        id: 'game-1',
        name: 'New Game',
        coverImage: 'cover.jpg',
        description: 'A great game',
      });

      await service.create({
        name: 'New Game',
        slug: 'new-game',
        platform: ['PC'],
        category: 'SHOOTER',
        coverImage: 'cover.jpg',
        description: 'A great game',
      });

      expect(mockPrismaService.game.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          coverImage: 'cover.jpg',
          description: 'A great game',
        }),
      });
    });
  });

  describe('seedGames', () => {
    it('should seed default games', async () => {
      mockPrismaService.game.upsert.mockResolvedValue({});

      const result = await service.seedGames();

      expect(result.message).toBe('Games seeded successfully');
      expect(mockPrismaService.game.upsert).toHaveBeenCalledTimes(10);
    });

    it('should upsert games without duplicating', async () => {
      mockPrismaService.game.upsert.mockResolvedValue({});

      await service.seedGames();

      expect(mockPrismaService.game.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'ea-fc-25' },
          update: {},
          create: expect.objectContaining({
            name: 'EA Sports FC 25',
            slug: 'ea-fc-25',
          }),
        }),
      );
    });
  });
});
