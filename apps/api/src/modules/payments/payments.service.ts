import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { PLATFORM_FEES } from 'shared';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  /**
   * Create checkout session for tournament entry fee
   */
  async createTournamentEntryCheckout(
    tournamentId: string,
    userId: string,
  ): Promise<{ checkoutUrl: string }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: { select: { participants: true } },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new BadRequestException('Tournament registration is not open');
    }

    if (tournament._count.participants >= tournament.maxParticipants) {
      throw new BadRequestException('Tournament is full');
    }

    if (tournament.entryFee <= 0) {
      throw new BadRequestException('This tournament is free - no payment required');
    }

    // Check if already registered
    const existingParticipant = await this.prisma.tournamentParticipant.findFirst({
      where: { tournamentId, userId },
    });

    if (existingParticipant) {
      throw new BadRequestException('Already registered for this tournament');
    }

    // Check for existing pending transaction
    const pendingTransaction = await this.prisma.transaction.findFirst({
      where: {
        userId,
        tournamentId,
        type: 'ENTRY_FEE',
        status: 'PENDING',
      },
    });

    if (pendingTransaction) {
      throw new BadRequestException('You have a pending payment for this tournament');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const session = await this.stripeService.createCheckoutSession({
      tournamentId,
      tournamentName: tournament.name,
      userId,
      amount: tournament.entryFee,
      successUrl: `${frontendUrl}/tournaments/${tournament.slug}?payment=success`,
      cancelUrl: `${frontendUrl}/tournaments/${tournament.slug}?payment=cancelled`,
    });

    // Create pending transaction
    await this.prisma.transaction.create({
      data: {
        userId,
        tournamentId,
        type: 'ENTRY_FEE',
        amount: tournament.entryFee,
        platformFee: tournament.entryFee * PLATFORM_FEES.FREE_TIER,
        status: 'PENDING',
        stripePaymentId: session.id,
        description: `Entry fee for ${tournament.name}`,
      },
    });

    return { checkoutUrl: session.url! };
  }

  /**
   * Handle successful payment webhook
   */
  async handlePaymentSuccess(session: Stripe.Checkout.Session): Promise<void> {
    const { tournamentId, userId } = session.metadata || {};

    if (!tournamentId || !userId) {
      console.error('Missing metadata in checkout session:', session.id);
      return;
    }

    // Update transaction status
    await this.prisma.transaction.updateMany({
      where: {
        stripePaymentId: session.id,
        status: 'PENDING',
      },
      data: {
        status: 'COMPLETED',
        stripePaymentId: (session.payment_intent as string) || session.id,
      },
    });

    // Check if participant already exists (idempotency)
    const existingParticipant = await this.prisma.tournamentParticipant.findFirst({
      where: { tournamentId, userId },
    });

    if (!existingParticipant) {
      // Register user for tournament
      await this.prisma.tournamentParticipant.create({
        data: {
          tournamentId,
          userId,
          status: 'REGISTERED',
        },
      });

      // Update tournament prize pool
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
      });

      if (tournament) {
        const netAmount = tournament.entryFee * (1 - PLATFORM_FEES.FREE_TIER);
        await this.prisma.tournament.update({
          where: { id: tournamentId },
          data: {
            prizePool: { increment: netAmount },
          },
        });
      }
    }
  }

  /**
   * Handle failed/expired payment
   */
  async handlePaymentFailed(session: Stripe.Checkout.Session): Promise<void> {
    await this.prisma.transaction.updateMany({
      where: {
        stripePaymentId: session.id,
        status: 'PENDING',
      },
      data: {
        status: 'FAILED',
      },
    });
  }

  /**
   * Distribute prizes to tournament winners
   */
  async distributePrizes(tournamentId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          where: {
            placement: { in: [1, 2, 3] },
          },
          include: {
            user: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    if (tournament.status !== 'COMPLETED') {
      throw new BadRequestException('Tournament is not completed');
    }

    if (tournament.prizePool <= 0) {
      return; // No prizes to distribute
    }

    // Prize distribution: 1st: 60%, 2nd: 30%, 3rd: 10%
    const prizeDistribution: Record<number, number> = {
      1: 0.6,
      2: 0.3,
      3: 0.1,
    };

    for (const participant of tournament.participants) {
      if (!participant.placement || !participant.user) continue;

      const percentage = prizeDistribution[participant.placement];
      if (!percentage) continue;

      const prizeAmount = tournament.prizePool * percentage;

      // Create payout transaction record
      await this.prisma.transaction.create({
        data: {
          userId: participant.userId!,
          tournamentId,
          type: 'PRIZE_PAYOUT',
          amount: prizeAmount,
          status: 'COMPLETED',
          description: `${this.getPlacementString(participant.placement)} place prize for ${tournament.name}`,
        },
      });

      // Update user stats
      await this.prisma.userStats.update({
        where: { userId: participant.userId! },
        data: {
          totalEarnings: { increment: prizeAmount },
          tournamentsWon: participant.placement === 1 ? { increment: 1 } : undefined,
        },
      });
    }
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(
    userId: string,
    options: { page?: number; pageSize?: number },
  ) {
    const { page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tournament: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);

    return {
      items: transactions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get tournament transactions
   */
  async getTournamentTransactions(tournamentId: string) {
    return this.prisma.transaction.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });
  }

  /**
   * Process refund for a tournament entry
   */
  async refundEntry(
    tournamentId: string,
    userId: string,
    requesterId: string,
  ): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Only allow refunds before tournament starts
    if (tournament.status !== 'REGISTRATION_OPEN') {
      throw new BadRequestException('Cannot refund after registration closes');
    }

    // Verify requester is the user or tournament organizer
    if (requesterId !== userId && requesterId !== tournament.createdById) {
      throw new BadRequestException('Not authorized to process this refund');
    }

    // Find the original transaction
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        userId,
        tournamentId,
        type: 'ENTRY_FEE',
        status: 'COMPLETED',
      },
    });

    if (!transaction) {
      throw new NotFoundException('No completed payment found for this entry');
    }

    // Process refund through Stripe
    if (transaction.stripePaymentId) {
      await this.stripeService.createRefund({
        paymentIntentId: transaction.stripePaymentId,
        reason: 'requested_by_customer',
      });
    }

    // Update transaction
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'REFUNDED' },
    });

    // Create refund transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        tournamentId,
        type: 'REFUND',
        amount: -transaction.amount,
        status: 'COMPLETED',
        description: `Refund for ${tournament.name} entry fee`,
      },
    });

    // Remove participant
    await this.prisma.tournamentParticipant.deleteMany({
      where: { tournamentId, userId },
    });

    // Update prize pool
    const netAmount = transaction.amount * (1 - PLATFORM_FEES.FREE_TIER);
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        prizePool: { decrement: netAmount },
      },
    });
  }

  private getPlacementString(placement: number): string {
    switch (placement) {
      case 1:
        return '1st';
      case 2:
        return '2nd';
      case 3:
        return '3rd';
      default:
        return `${placement}th`;
    }
  }
}
