import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPrismaService = {
    tournament: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tournamentParticipant: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockWalletService = {
    getBalance: jest.fn(),
    addCredits: jest.fn(),
    deductCredits: jest.fn(),
    refundCredits: jest.fn(),
    awardPrize: jest.fn(),
    getTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('payEntryFee', () => {
    it('should pay entry fee with credits for paid tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Tournament',
        status: 'REGISTRATION_OPEN',
        entryFee: 10,
        maxParticipants: 16,
        _count: { participants: 5 },
      });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue(null);
      mockWalletService.getBalance.mockResolvedValue(1000); // 1000 credits = $10

      const result = await service.payEntryFee('1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw if tournament not found', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);

      await expect(
        service.payEntryFee('non-existent', 'user-1')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if tournament is full', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        entryFee: 10,
        maxParticipants: 16,
        _count: { participants: 16 },
      });

      await expect(
        service.payEntryFee('1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if already registered', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        entryFee: 10,
        maxParticipants: 16,
        _count: { participants: 5 },
      });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.payEntryFee('1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if insufficient credits', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        entryFee: 10,
        maxParticipants: 16,
        _count: { participants: 5 },
      });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue(null);
      mockWalletService.getBalance.mockResolvedValue(500); // Only $5 in credits

      await expect(
        service.payEntryFee('1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundEntry', () => {
    it('should process refund and remove participant', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Tournament',
        status: 'REGISTRATION_OPEN',
        createdById: 'organizer-1',
      });
      mockPrismaService.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        amount: 10,
      });

      await service.refundEntry('1', 'user-1', 'user-1');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw if tournament has started', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.refundEntry('1', 'user-1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if not authorized', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        createdById: 'organizer-1',
      });

      await expect(
        service.refundEntry('1', 'user-1', 'other-user')
      ).rejects.toThrow(BadRequestException);
    });
  });
});
