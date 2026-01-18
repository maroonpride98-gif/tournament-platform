import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    tournament: {
      findUnique: jest.fn(),
    },
    userStats: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockNotificationsService = {
    notifyPrizeWon: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    it('should return user credits balance', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ credits: 5000 });

      const balance = await service.getBalance('user-1');

      expect(balance).toBe(5000);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { credits: true },
      });
    });

    it('should return 0 if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const balance = await service.getBalance('non-existent');

      expect(balance).toBe(0);
    });
  });

  describe('addCredits', () => {
    it('should add credits to user and create transaction', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        credits: 6000,
        username: 'testuser',
      });
      mockPrismaService.transaction.create.mockResolvedValue({
        id: 'tx-1',
        type: 'CREDIT_PURCHASE',
      });

      const result = await service.addCredits('user-1', 1000, 'Test purchase');

      expect(result.user.credits).toBe(6000);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(service.addCredits('user-1', 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addCredits('user-1', -100)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits if user has sufficient balance', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ credits: 5000 });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        credits: 4000,
      });
      mockPrismaService.transaction.create.mockResolvedValue({
        id: 'tx-1',
        type: 'ENTRY_FEE',
      });

      const result = await service.deductCredits('user-1', 1000);

      expect(result.user.credits).toBe(4000);
    });

    it('should throw if insufficient credits', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ credits: 500 });

      await expect(service.deductCredits('user-1', 1000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(service.deductCredits('user-1', 0)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refundCredits', () => {
    it('should refund credits and create transaction', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        credits: 6000,
      });
      mockPrismaService.transaction.create.mockResolvedValue({
        id: 'tx-1',
        type: 'REFUND',
      });

      const result = await service.refundCredits('user-1', 1000, 'tournament-1');

      expect(result.user.credits).toBe(6000);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(service.refundCredits('user-1', 0)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('awardPrize', () => {
    it('should award prize, update stats, and send notification', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        name: 'Test Tournament',
        slug: 'test-tournament',
      });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-1',
        credits: 10000,
        username: 'winner',
      });
      mockPrismaService.userStats.upsert.mockResolvedValue({});
      mockPrismaService.transaction.create.mockResolvedValue({
        id: 'tx-1',
        type: 'PRIZE_PAYOUT',
      });

      const result = await service.awardPrize('user-1', 5000, 'tournament-1', 1);

      expect(result?.user.credits).toBe(10000);
      expect(mockPrismaService.userStats.upsert).toHaveBeenCalled();
      expect(mockNotificationsService.notifyPrizeWon).toHaveBeenCalledWith(
        'user-1',
        50, // 5000 credits / 100 = $50
        'Test Tournament',
        1,
        'test-tournament',
      );
    });

    it('should return null for zero prize', async () => {
      const result = await service.awardPrize('user-1', 0, 'tournament-1', 1);

      expect(result).toBeNull();
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { id: 'tx-1', type: 'CREDIT_PURCHASE' },
        { id: 'tx-2', type: 'ENTRY_FEE' },
      ]);
      mockPrismaService.transaction.count.mockResolvedValue(10);

      const result = await service.getTransactions('user-1', 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('adminAddCredits', () => {
    it('should allow admin to add credits', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'target-user',
        credits: 5000,
        username: 'testuser',
      });
      mockPrismaService.transaction.create.mockResolvedValue({});

      await service.adminAddCredits('admin-1', 'target-user', 1000, 'Bonus');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw if requester is not admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'USER' });

      await expect(
        service.adminAddCredits('user-1', 'target-user', 1000),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
