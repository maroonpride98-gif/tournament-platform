import { Test, TestingModule } from '@nestjs/testing';
import { BracketService } from './bracket.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';

describe('BracketService', () => {
  let service: BracketService;

  const mockPrismaService = {
    match: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tournament: {
      update: jest.fn(),
    },
    tournamentParticipant: {
      updateMany: jest.fn(),
    },
  };

  const mockPaymentsService = {
    distributePrizes: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BracketService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    service = module.get<BracketService>(BracketService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSingleElimination', () => {
    it('should generate bracket for 4 participants', () => {
      const participants = [
        { id: '1', user: { id: 'u1', username: 'Player1' } },
        { id: '2', user: { id: 'u2', username: 'Player2' } },
        { id: '3', user: { id: 'u3', username: 'Player3' } },
        { id: '4', user: { id: 'u4', username: 'Player4' } },
      ];

      const result = service.generateSingleElimination(participants);

      expect(result.matches).toHaveLength(3); // 2 first round + 1 final
      expect(result.bracketData.totalRounds).toBe(2);
      expect(result.bracketData.rounds).toHaveLength(2);
    });

    it('should generate bracket for 8 participants', () => {
      const participants = Array.from({ length: 8 }, (_, i) => ({
        id: `${i + 1}`,
        user: { id: `u${i + 1}`, username: `Player${i + 1}` },
      }));

      const result = service.generateSingleElimination(participants);

      expect(result.matches).toHaveLength(7); // 4 + 2 + 1
      expect(result.bracketData.totalRounds).toBe(3);
    });

    it('should handle byes for non-power-of-2 participants', () => {
      const participants = [
        { id: '1', user: { id: 'u1', username: 'Player1' } },
        { id: '2', user: { id: 'u2', username: 'Player2' } },
        { id: '3', user: { id: 'u3', username: 'Player3' } },
      ];

      const result = service.generateSingleElimination(participants);

      // Should create 4-player bracket with 1 bye
      expect(result.bracketData.totalRounds).toBe(2);

      // First round should have one match with a bye
      const firstRoundMatches = result.matches.filter(m => m.round === 1);
      const byeMatch = firstRoundMatches.find(m => m.participant2Id === null);
      expect(byeMatch).toBeDefined();
    });

    it('should respect seeding order when provided', () => {
      const participants = [
        { id: '1', user: { id: 'u1', username: 'Player1' }, seed: 2 },
        { id: '2', user: { id: 'u2', username: 'Player2' }, seed: 1 },
        { id: '3', user: { id: 'u3', username: 'Player3' }, seed: 4 },
        { id: '4', user: { id: 'u4', username: 'Player4' }, seed: 3 },
      ];

      const result = service.generateSingleElimination(participants);

      const firstMatch = result.matches.find(m => m.round === 1 && m.matchNumber === 1);

      // First seed should be in first position
      expect(firstMatch?.participant1Id).toBe('u2');
    });
  });

  describe('generateDoubleElimination', () => {
    it('should generate double elimination bracket for 4 participants', () => {
      const participants = [
        { id: '1', user: { id: 'u1', username: 'Player1' } },
        { id: '2', user: { id: 'u2', username: 'Player2' } },
        { id: '3', user: { id: 'u3', username: 'Player3' } },
        { id: '4', user: { id: 'u4', username: 'Player4' } },
      ];

      const result = service.generateDoubleElimination(participants);

      // Should have winners bracket, losers bracket, and grand finals
      expect(result.bracketData.type).toBe('DOUBLE_ELIMINATION');
      expect(result.bracketData.winnersRounds).toBe(2);
      expect(result.bracketData.winners).toHaveLength(2);
      expect(result.bracketData.losers).toBeDefined();
      expect(result.bracketData.grandFinals).toHaveLength(1);

      // Winners bracket matches + losers bracket matches + grand finals
      expect(result.matches.length).toBeGreaterThan(3);
    });

    it('should generate double elimination bracket for 8 participants', () => {
      const participants = Array.from({ length: 8 }, (_, i) => ({
        id: `${i + 1}`,
        user: { id: `u${i + 1}`, username: `Player${i + 1}` },
      }));

      const result = service.generateDoubleElimination(participants);

      expect(result.bracketData.type).toBe('DOUBLE_ELIMINATION');
      expect(result.bracketData.winnersRounds).toBe(3);
      expect(result.bracketData.winners).toHaveLength(3);
    });
  });

  describe('advanceWinner', () => {
    it('should advance winner to next match', async () => {
      mockPrismaService.match.findUnique.mockResolvedValue({
        id: 'match-1',
        round: 1,
        tournamentId: '1',
        bracketPosition: {
          nextMatchNumber: 1,
          nextMatchPosition: 'participant1',
        },
        tournament: { id: '1' },
      });
      mockPrismaService.match.findFirst.mockResolvedValue({
        id: 'match-2',
        round: 2,
        participant1Id: null,
        participant2Id: null,
      });
      mockPrismaService.match.update.mockResolvedValue({
        id: 'match-2',
        participant1Id: 'winner-id',
      });

      await service.advanceWinner('match-1', 'winner-id');

      expect(mockPrismaService.match.update).toHaveBeenCalledWith({
        where: { id: 'match-2' },
        data: { participant1Id: 'winner-id' },
      });
    });

    it('should mark tournament complete if finals match', async () => {
      mockPrismaService.match.findUnique.mockResolvedValue({
        id: 'final-match',
        round: 3,
        tournamentId: '1',
        participant1Id: 'winner-id',
        participant2Id: 'loser-id',
        bracketPosition: {
          nextMatchNumber: null, // No next match = finals
        },
        tournament: { id: '1' },
      });
      mockPaymentsService.distributePrizes.mockResolvedValue({ distributed: true });

      await service.advanceWinner('final-match', 'winner-id');

      expect(mockPrismaService.tournament.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'COMPLETED' },
      });
      // Should update winner (1st place)
      expect(mockPrismaService.tournamentParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          tournamentId: '1',
          OR: [{ userId: 'winner-id' }, { teamId: 'winner-id' }],
        },
        data: { status: 'WINNER', placement: 1 },
      });
      // Should update loser (2nd place)
      expect(mockPrismaService.tournamentParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          tournamentId: '1',
          OR: [{ userId: 'loser-id' }, { teamId: 'loser-id' }],
        },
        data: { status: 'ELIMINATED', placement: 2 },
      });
      // Should distribute prizes
      expect(mockPaymentsService.distributePrizes).toHaveBeenCalledWith('1');
    });
  });
});
