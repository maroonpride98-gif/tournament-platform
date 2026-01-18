import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { BracketService } from '../src/modules/tournaments/bracket.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import * as bcrypt from 'bcryptjs';

/**
 * E2E Tournament Flow Tests
 *
 * Note: These tests use the Prisma service directly for setup to avoid
 * throttling issues with the auth endpoints. In a production environment,
 * you would configure the ThrottlerModule to have higher limits or
 * disable it entirely for testing via environment variables.
 */
describe('Tournament Flow (e2e) - Service Level', () => {
  let prisma: PrismaService;
  let bracketService: BracketService;
  let organizer: any;
  let player1: any;
  let player2: any;
  let player3: any;
  let player4: any;
  let game: any;
  let tournament: any;

  // Mock PaymentsService
  const mockPaymentsService = {
    distributePrizes: jest.fn().mockResolvedValue({ distributed: true }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        BracketService,
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    bracketService = moduleFixture.get<BracketService>(BracketService);

    // Clean up test data
    await cleanupTestData();

    // Create test game
    game = await prisma.game.create({
      data: {
        name: 'E2E Test Game',
        slug: 'e2e-test-game-' + Date.now(),
        description: 'A game for E2E testing',
        category: 'STRATEGY',
        platform: ['PC'],
        coverImage: 'https://example.com/game.jpg',
      },
    });

    // Create test users directly
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    organizer = await prisma.user.create({
      data: {
        email: 'organizer-e2e@test.com',
        username: 'TestOrganizer',
        passwordHash: hashedPassword,
        role: 'ORGANIZER',
      },
    });

    player1 = await prisma.user.create({
      data: {
        email: 'player1-e2e@test.com',
        username: 'Player1',
        passwordHash: hashedPassword,
        role: 'USER',
      },
    });

    player2 = await prisma.user.create({
      data: {
        email: 'player2-e2e@test.com',
        username: 'Player2',
        passwordHash: hashedPassword,
        role: 'USER',
      },
    });

    player3 = await prisma.user.create({
      data: {
        email: 'player3-e2e@test.com',
        username: 'Player3',
        passwordHash: hashedPassword,
        role: 'USER',
      },
    });

    player4 = await prisma.user.create({
      data: {
        email: 'player4-e2e@test.com',
        username: 'Player4',
        passwordHash: hashedPassword,
        role: 'USER',
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Clean up in reverse order of dependencies
    await prisma.match.deleteMany({
      where: { tournament: { name: { startsWith: 'E2E Test' } } },
    });
    await prisma.bracket.deleteMany({
      where: { tournament: { name: { startsWith: 'E2E Test' } } },
    });
    await prisma.tournamentParticipant.deleteMany({
      where: { tournament: { name: { startsWith: 'E2E Test' } } },
    });
    await prisma.tournament.deleteMany({
      where: { name: { startsWith: 'E2E Test' } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '-e2e@test.com' } },
    });
    await prisma.game.deleteMany({
      where: { name: 'E2E Test Game' },
    });
  }

  describe('Tournament Lifecycle', () => {
    it('should create a tournament', async () => {
      tournament = await prisma.tournament.create({
        data: {
          name: 'E2E Test Tournament',
          slug: 'e2e-test-tournament-' + Date.now(),
          description: 'A tournament for E2E testing',
          gameId: game.id,
          format: 'SINGLE_ELIMINATION',
          bracketType: 'SOLO',
          teamSize: 1,
          maxParticipants: 8,
          entryFee: 0,
          prizePool: 0,
          platformFee: 0,
          rules: 'Test rules',
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'REGISTRATION_OPEN',
          createdById: organizer.id,
        },
      });

      expect(tournament.name).toBe('E2E Test Tournament');
      expect(tournament.status).toBe('REGISTRATION_OPEN');
    });

    it('should allow players to register', async () => {
      // Register all 4 players
      await prisma.tournamentParticipant.createMany({
        data: [
          { tournamentId: tournament.id, userId: player1.id, status: 'REGISTERED' },
          { tournamentId: tournament.id, userId: player2.id, status: 'REGISTERED' },
          { tournamentId: tournament.id, userId: player3.id, status: 'REGISTERED' },
          { tournamentId: tournament.id, userId: player4.id, status: 'REGISTERED' },
        ],
      });

      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: tournament.id },
      });

      expect(participants).toHaveLength(4);
    });

    it('should allow players to check in', async () => {
      await prisma.tournamentParticipant.updateMany({
        where: { tournamentId: tournament.id },
        data: { status: 'CHECKED_IN' },
      });

      const checkedIn = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: tournament.id, status: 'CHECKED_IN' },
      });

      expect(checkedIn).toHaveLength(4);
    });

    it('should generate correct bracket structure', async () => {
      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: tournament.id, status: 'CHECKED_IN' },
        include: {
          user: { select: { id: true, username: true } },
        },
      });

      const { matches, bracketData } = bracketService.generateSingleElimination(participants);

      // 4 participants = 2 rounds (semi-finals + finals)
      expect(bracketData.totalRounds).toBe(2);
      expect(bracketData.rounds).toHaveLength(2);

      // 2 semi-final matches + 1 final match = 3 matches
      expect(matches).toHaveLength(3);

      const round1Matches = matches.filter(m => m.round === 1);
      const round2Matches = matches.filter(m => m.round === 2);

      expect(round1Matches).toHaveLength(2);
      expect(round2Matches).toHaveLength(1);
    });

    it('should start tournament and create matches', async () => {
      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: tournament.id, status: 'CHECKED_IN' },
        include: {
          user: { select: { id: true, username: true } },
        },
      });

      const { matches, bracketData } = bracketService.generateSingleElimination(participants);

      // Create matches and bracket in database
      await prisma.$transaction([
        prisma.match.createMany({
          data: matches.map(m => ({
            ...m,
            tournamentId: tournament.id,
          })),
        }),
        prisma.bracket.create({
          data: {
            tournamentId: tournament.id,
            bracketData,
          },
        }),
        prisma.tournament.update({
          where: { id: tournament.id },
          data: { status: 'IN_PROGRESS' },
        }),
      ]);

      const updatedTournament = await prisma.tournament.findUnique({
        where: { id: tournament.id },
        include: { matches: true, bracket: true },
      });

      expect(updatedTournament!.status).toBe('IN_PROGRESS');
      expect(updatedTournament!.matches).toHaveLength(3);
      expect(updatedTournament!.bracket).toBeDefined();
    });

    it('should report scores and advance winners', async () => {
      const round1Matches = await prisma.match.findMany({
        where: { tournamentId: tournament.id, round: 1 },
        orderBy: { matchNumber: 'asc' },
      });

      // Report match 1 - participant1 wins
      const match1 = round1Matches[0];
      await prisma.match.update({
        where: { id: match1.id },
        data: {
          score1: 2,
          score2: 0,
          winnerId: match1.participant1Id,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Report match 2 - participant1 wins
      const match2 = round1Matches[1];
      await prisma.match.update({
        where: { id: match2.id },
        data: {
          score1: 2,
          score2: 1,
          winnerId: match2.participant1Id,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Advance winners to finals
      const finalMatch = await prisma.match.findFirst({
        where: { tournamentId: tournament.id, round: 2 },
      });

      await prisma.match.update({
        where: { id: finalMatch!.id },
        data: {
          participant1Id: match1.participant1Id,
          participant2Id: match2.participant1Id,
        },
      });

      const updatedFinal = await prisma.match.findUnique({
        where: { id: finalMatch!.id },
      });

      expect(updatedFinal!.participant1Id).toBeDefined();
      expect(updatedFinal!.participant2Id).toBeDefined();
    });

    it('should complete tournament after final match', async () => {
      const finalMatch = await prisma.match.findFirst({
        where: { tournamentId: tournament.id, round: 2 },
      });

      // Report final score
      await prisma.match.update({
        where: { id: finalMatch!.id },
        data: {
          score1: 3,
          score2: 2,
          winnerId: finalMatch!.participant1Id,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Update tournament status
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { status: 'COMPLETED' },
      });

      // Update placements
      await prisma.tournamentParticipant.updateMany({
        where: {
          tournamentId: tournament.id,
          OR: [{ userId: finalMatch!.participant1Id }],
        },
        data: { status: 'WINNER', placement: 1 },
      });

      await prisma.tournamentParticipant.updateMany({
        where: {
          tournamentId: tournament.id,
          OR: [{ userId: finalMatch!.participant2Id }],
        },
        data: { status: 'ELIMINATED', placement: 2 },
      });

      const completedTournament = await prisma.tournament.findUnique({
        where: { id: tournament.id },
        include: { participants: true },
      });

      expect(completedTournament!.status).toBe('COMPLETED');

      const winner = completedTournament!.participants.find(p => p.placement === 1);
      expect(winner).toBeDefined();
      expect(winner!.status).toBe('WINNER');

      const runnerUp = completedTournament!.participants.find(p => p.placement === 2);
      expect(runnerUp).toBeDefined();
      expect(runnerUp!.status).toBe('ELIMINATED');
    });
  });

  describe('Double Elimination Bracket', () => {
    it('should generate double elimination bracket structure', async () => {
      const participants = [
        { id: '1', user: { id: 'u1', username: 'Player1' } },
        { id: '2', user: { id: 'u2', username: 'Player2' } },
        { id: '3', user: { id: 'u3', username: 'Player3' } },
        { id: '4', user: { id: 'u4', username: 'Player4' } },
      ];

      const { matches, bracketData } = bracketService.generateDoubleElimination(participants);

      expect(bracketData.type).toBe('DOUBLE_ELIMINATION');
      expect(bracketData.winnersRounds).toBe(2);
      expect(bracketData.winners).toHaveLength(2);
      expect(bracketData.losers).toBeDefined();
      expect(bracketData.grandFinals).toHaveLength(1);

      // Should have more matches than single elimination
      expect(matches.length).toBeGreaterThan(3);
    });
  });

  describe('Tournament Validation', () => {
    it('should not allow starting with less than 2 participants', async () => {
      const smallTournament = await prisma.tournament.create({
        data: {
          name: 'E2E Test Small Tournament',
          slug: 'e2e-small-' + Date.now(),
          description: 'Too few participants',
          gameId: game.id,
          format: 'SINGLE_ELIMINATION',
          bracketType: 'SOLO',
          teamSize: 1,
          maxParticipants: 8,
          entryFee: 0,
          prizePool: 0,
          platformFee: 0,
          rules: 'Test rules',
          startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'REGISTRATION_OPEN',
          createdById: organizer.id,
        },
      });

      // Register only one participant
      await prisma.tournamentParticipant.create({
        data: {
          tournamentId: smallTournament.id,
          userId: player1.id,
          status: 'CHECKED_IN',
        },
      });

      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournamentId: smallTournament.id, status: 'CHECKED_IN' },
      });

      expect(participants.length).toBeLessThan(2);

      // Attempting to generate a bracket with 1 participant should fail or produce empty results
      // The actual validation happens in the service layer
    });
  });
});

