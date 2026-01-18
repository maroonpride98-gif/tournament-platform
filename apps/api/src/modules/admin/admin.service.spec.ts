import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaService = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tournament: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    game: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    tournamentParticipant: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return admin dashboard stats', async () => {
      mockPrismaService.user.count.mockResolvedValueOnce(100);
      mockPrismaService.tournament.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10);
      mockPrismaService.game.count.mockResolvedValue(5);
      mockPrismaService.tournament.aggregate.mockResolvedValue({
        _sum: { prizePool: 5000 },
      });
      mockPrismaService.user.count.mockResolvedValueOnce(15);

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 100,
        totalTournaments: 50,
        activeTournaments: 10,
        totalGames: 5,
        totalPrizePool: 5000,
        recentSignups: 15,
      });
    });
  });

  describe('getTransactionStats', () => {
    it('should return transaction statistics', async () => {
      mockPrismaService.transaction.count.mockResolvedValue(500);
      mockPrismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 10000 }, _count: 100 }) // credit purchases
        .mockResolvedValueOnce({ _sum: { amount: 5000 }, _count: 200 }) // entry fees
        .mockResolvedValueOnce({ _sum: { amount: 3000 }, _count: 50 }) // prize payouts
        .mockResolvedValueOnce({ _sum: { amount: 500 }, _count: 10 }) // refunds
        .mockResolvedValueOnce({ _sum: { amount: 2000 } }); // last 30 days

      const result = await service.getTransactionStats();

      expect(result).toEqual({
        totalTransactions: 500,
        creditPurchases: { count: 100, total: 10000 },
        entryFees: { count: 200, total: 5000 },
        prizePayouts: { count: 50, total: 3000 },
        refunds: { count: 10, total: 500 },
        last30DaysRevenue: 2000,
      });
    });

    it('should handle null amounts', async () => {
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: 0,
      });

      const result = await service.getTransactionStats();

      expect(result.creditPurchases.total).toBe(0);
      expect(result.last30DaysRevenue).toBe(0);
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: '1', type: 'CREDIT_PURCHASE', amount: 100, user: { id: 'u1', username: 'user1' } },
        { id: '2', type: 'ENTRY_FEE', amount: 50, user: { id: 'u2', username: 'user2' } },
      ];
      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.transaction.count.mockResolvedValue(2);

      const result = await service.getTransactions({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: mockTransactions,
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
    });

    it('should filter by type and status', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      await service.getTransactions({ type: 'CREDIT_PURCHASE', status: 'COMPLETED' });

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'CREDIT_PURCHASE', status: 'COMPLETED' },
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.count.mockResolvedValue(0);

      await service.getTransactions({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('getPaymentReport', () => {
    it('should return payment report for date range', async () => {
      mockPrismaService.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 10000 }, _count: 100 }) // credit purchases
        .mockResolvedValueOnce({ _sum: { amount: 5000 }, _count: 200 }) // entry fees
        .mockResolvedValueOnce({ _sum: { amount: 3000 }, _count: 50 }) // prize payouts
        .mockResolvedValueOnce({ _sum: { amount: 500 }, _count: 10 }); // refunds
      mockPrismaService.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getPaymentReport('2024-01-01', '2024-01-31');

      expect(result).toEqual({
        period: { startDate: '2024-01-01', endDate: '2024-01-31' },
        creditPurchases: { count: 100, total: 10000 },
        entryFees: { count: 200, total: 5000 },
        prizePayouts: { count: 50, total: 3000 },
        refunds: { count: 10, total: 500 },
        platformRevenue: 2000, // entry fees - prize payouts
        grossRevenue: 10000,
      });
    });
  });

  describe('cancelTournament', () => {
    it('should cancel tournament and process refunds', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: 't1',
        name: 'Test Tournament',
        status: 'REGISTRATION_OPEN',
        entryFee: 10,
      });
      mockPrismaService.tournament.update.mockResolvedValue({ id: 't1', status: 'CANCELLED' });
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { id: 'tx1', userId: 'u1', amount: 10, tournamentId: 't1' },
      ]);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      const result = await service.cancelTournament('t1', 'admin1');

      expect(result.message).toBe('Tournament cancelled successfully');
      expect(mockPrismaService.tournament.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'CANCELLED', prizePool: 0 },
      });
    });

    it('should throw error for completed tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: 't1',
        status: 'COMPLETED',
      });

      await expect(service.cancelTournament('t1', 'admin1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw error for already cancelled tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: 't1',
        status: 'CANCELLED',
      });

      await expect(service.cancelTournament('t1', 'admin1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        id: 'u1',
        username: 'testuser',
        role: 'ORGANIZER',
      });

      const result = await service.updateUserRole('u1', 'ORGANIZER');

      expect(result.role).toBe('ORGANIZER');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { role: 'ORGANIZER' },
        select: { id: true, username: true, role: true },
      });
    });
  });
});
