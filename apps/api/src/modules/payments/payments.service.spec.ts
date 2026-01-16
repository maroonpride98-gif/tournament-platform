import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
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
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userStats: {
      update: jest.fn(),
    },
  };

  const mockStripeService = {
    createCheckoutSession: jest.fn(),
    createRefund: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        FRONTEND_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTournamentEntryCheckout', () => {
    it('should create checkout session for paid tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Tournament',
        slug: 'test-tournament',
        status: 'REGISTRATION_OPEN',
        entryFee: 10,
        maxParticipants: 16,
        _count: { participants: 5 },
      });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockStripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/pay/cs_123',
      });
      mockPrismaService.transaction.create.mockResolvedValue({});

      const result = await service.createTournamentEntryCheckout('1', 'user-1');

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_123');
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalled();
    });

    it('should throw if tournament not found', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);

      await expect(
        service.createTournamentEntryCheckout('non-existent', 'user-1')
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
        service.createTournamentEntryCheckout('1', 'user-1')
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
        service.createTournamentEntryCheckout('1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if tournament is free', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        entryFee: 0,
        maxParticipants: 16,
        _count: { participants: 5 },
      });

      await expect(
        service.createTournamentEntryCheckout('1', 'user-1')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handlePaymentSuccess', () => {
    it('should register user after successful payment', async () => {
      const session = {
        id: 'cs_123',
        metadata: {
          tournamentId: '1',
          userId: 'user-1',
        },
        payment_intent: 'pi_123',
      };

      mockPrismaService.transaction.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue(null);
      mockPrismaService.tournamentParticipant.create.mockResolvedValue({});
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        entryFee: 10,
      });
      mockPrismaService.tournament.update.mockResolvedValue({});

      await service.handlePaymentSuccess(session as any);

      expect(mockPrismaService.tournamentParticipant.create).toHaveBeenCalledWith({
        data: {
          tournamentId: '1',
          userId: 'user-1',
          status: 'REGISTERED',
        },
      });
    });

    it('should be idempotent if participant already exists', async () => {
      const session = {
        id: 'cs_123',
        metadata: {
          tournamentId: '1',
          userId: 'user-1',
        },
      };

      mockPrismaService.transaction.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.tournamentParticipant.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await service.handlePaymentSuccess(session as any);

      expect(mockPrismaService.tournamentParticipant.create).not.toHaveBeenCalled();
    });
  });

  describe('refundEntry', () => {
    it('should process refund and remove participant', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: '1',
        status: 'REGISTRATION_OPEN',
        createdById: 'organizer-1',
      });
      mockPrismaService.transaction.findFirst.mockResolvedValue({
        id: 'tx-1',
        amount: 10,
        stripePaymentId: 'pi_123',
      });
      mockStripeService.createRefund.mockResolvedValue({});
      mockPrismaService.transaction.update.mockResolvedValue({});
      mockPrismaService.transaction.create.mockResolvedValue({});
      mockPrismaService.tournamentParticipant.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.tournament.update.mockResolvedValue({});

      await service.refundEntry('1', 'user-1', 'user-1');

      expect(mockStripeService.createRefund).toHaveBeenCalled();
      expect(mockPrismaService.tournamentParticipant.deleteMany).toHaveBeenCalled();
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
  });
});
