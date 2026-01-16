import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async findAll(options: {
    category?: string;
    platform?: string;
    search?: string;
  }) {
    const { category, platform, search } = options;

    const where: any = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (platform) {
      where.platform = { has: platform };
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    return this.prisma.game.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(idOrSlug: string) {
    const game = await this.prisma.game.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        _count: {
          select: { tournaments: true },
        },
      },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  async create(data: {
    name: string;
    slug: string;
    platform: string[];
    category: string;
    coverImage?: string;
    description?: string;
  }) {
    return this.prisma.game.create({
      data: {
        name: data.name,
        slug: data.slug,
        platform: data.platform as any,
        category: data.category as any,
        coverImage: data.coverImage,
        description: data.description,
      },
    });
  }

  async seedGames() {
    const games = [
      { name: 'EA Sports FC 25', slug: 'ea-fc-25', platform: ['PS5', 'XBOX', 'PC'], category: 'SPORTS' },
      { name: 'Call of Duty: Warzone', slug: 'cod-warzone', platform: ['CROSS_PLATFORM'], category: 'SHOOTER' },
      { name: 'Tekken 8', slug: 'tekken-8', platform: ['PS5', 'XBOX', 'PC'], category: 'FIGHTING' },
      { name: 'NBA 2K25', slug: 'nba-2k25', platform: ['PS5', 'XBOX', 'PC'], category: 'SPORTS' },
      { name: 'Street Fighter 6', slug: 'sf6', platform: ['PS5', 'XBOX', 'PC'], category: 'FIGHTING' },
      { name: 'Fortnite', slug: 'fortnite', platform: ['CROSS_PLATFORM'], category: 'BATTLE_ROYALE' },
      { name: 'Madden NFL 25', slug: 'madden-25', platform: ['PS5', 'XBOX', 'PC'], category: 'SPORTS' },
      { name: 'Mortal Kombat 1', slug: 'mk1', platform: ['PS5', 'XBOX', 'PC'], category: 'FIGHTING' },
      { name: 'Apex Legends', slug: 'apex', platform: ['CROSS_PLATFORM'], category: 'BATTLE_ROYALE' },
      { name: 'Rocket League', slug: 'rocket-league', platform: ['CROSS_PLATFORM'], category: 'SPORTS' },
    ];

    for (const game of games) {
      await this.prisma.game.upsert({
        where: { slug: game.slug },
        update: {},
        create: {
          name: game.name,
          slug: game.slug,
          platform: game.platform as any,
          category: game.category as any,
        },
      });
    }

    return { message: 'Games seeded successfully' };
  }
}
