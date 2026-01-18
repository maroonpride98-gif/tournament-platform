import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { PLATFORM_FEES } from 'shared';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  /**
   * Pay tournament entry fee using credits
   */
  async payEntryFee(
    tournamentId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
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

    // Check if already registered
    const existingParticipant = await this.prisma.tournamentParticipant.findFirst({
      where: { tournamentId, userId },
    });

    if (existingParticipant) {
      throw new BadRequestException('Already registered for this tournament');
    }

    // Convert entry fee to credits (1 dollar = 100 credits)
    const creditsRequired = Math.round(tournament.entryFee * 100);

    // Check user balance
    const balance = await this.walletService.getBalance(userId);
    if (balance < creditsRequired) {
      throw new BadRequestException(
        `Insufficient credits. Required: ${creditsRequired}, Available: ${balance}`,
      );
    }

    // Deduct credits and register in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Deduct credits
      await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: creditsRequired } },
      });

      // Create entry fee transaction
      await tx.transaction.create({
        data: {
          userId,
          tournamentId,
          type: 'ENTRY_FEE',
          amount: tournament.entryFee,
          creditAmount: -creditsRequired,
          platformFee: tournament.entryFee * PLATFORM_FEES.FREE_TIER,
          status: 'COMPLETED',
          description: `Entry fee for ${tournament.name}`,
        },
      });

      // Register participant
      await tx.tournamentParticipant.create({
        data: {
          tournamentId,
          userId,
          status: 'REGISTERED',
        },
      });

      // Update prize pool
      const netAmount = tournament.entryFee * (1 - PLATFORM_FEES.FREE_TIER);
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          prizePool: { increment: netAmount },
        },
      });
    });

    return {
      success: true,
      message: `Successfully registered for ${tournament.name}`,
    };
  }

  /**
   * Distribute prizes to tournament winners
   */
  async distributePrizes(tournamentId: string): Promise<{ distributed: boolean; message: string }> {
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

    if (tournament.prizeDistributed) {
      return { distributed: false, message: 'Prizes already distributed' };
    }

    if (tournament.prizePool <= 0) {
      // Mark as distributed even with no prizes
      await this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { prizeDistributed: true },
      });
      return { distributed: true, message: 'No prizes to distribute (free tournament)' };
    }

    // Prize distribution: 1st: 60%, 2nd: 30%, 3rd: 10%
    const prizeDistribution: Record<number, number> = {
      1: 0.6,
      2: 0.3,
      3: 0.1,
    };

    const winners: Array<{ placement: number; credits: number }> = [];

    for (const participant of tournament.participants) {
      if (!participant.placement || !participant.userId) continue;

      const percentage = prizeDistribution[participant.placement];
      if (!percentage) continue;

      const prizeAmount = tournament.prizePool * percentage;
      const prizeCredits = Math.round(prizeAmount * 100);

      // Award credits to winner
      await this.walletService.awardPrize(
        participant.userId,
        prizeCredits,
        tournamentId,
        participant.placement,
      );

      winners.push({ placement: participant.placement, credits: prizeCredits });
    }

    // Mark tournament as prizes distributed
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { prizeDistributed: true },
    });

    return {
      distributed: true,
      message: `Prizes distributed to ${winners.length} winner(s)`,
    };
  }

  /**
   * Verify user can distribute prizes (organizer or admin)
   */
  async getTournamentForPrizeDistribution(tournamentId: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isAdmin = user?.role === 'ADMIN';
    const isOrganizer = tournament.createdById === userId;

    if (!isAdmin && !isOrganizer) {
      throw new ForbiddenException('Only tournament organizer or admin can distribute prizes');
    }

    return tournament;
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(
    userId: string,
    options: { page?: number; pageSize?: number },
  ) {
    return this.walletService.getTransactions(
      userId,
      options.page,
      options.pageSize,
    );
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
   * Process refund for a tournament entry (credits returned)
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

    const creditsToRefund = Math.round(transaction.amount * 100);

    await this.prisma.$transaction(async (tx) => {
      // Refund credits to user
      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: creditsToRefund } },
      });

      // Update original transaction
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: 'REFUNDED' },
      });

      // Create refund transaction record
      await tx.transaction.create({
        data: {
          userId,
          tournamentId,
          type: 'REFUND',
          amount: transaction.amount,
          creditAmount: creditsToRefund,
          status: 'COMPLETED',
          description: `Refund for ${tournament.name} entry fee`,
        },
      });

      // Remove participant
      await tx.tournamentParticipant.deleteMany({
        where: { tournamentId, userId },
      });

      // Update prize pool
      const netAmount = transaction.amount * (1 - PLATFORM_FEES.FREE_TIER);
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          prizePool: { decrement: netAmount },
        },
      });
    });
  }
}
