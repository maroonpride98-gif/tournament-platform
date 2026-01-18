import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    return user?.credits || 0;
  }

  async addCredits(
    userId: string,
    amount: number,
    description?: string,
    squarePaymentId?: string,
    squareOrderId?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Update user credits
      const user = await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
        select: { id: true, credits: true, username: true },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'CREDIT_PURCHASE',
          amount: amount / 100, // Store as dollars (credits are cents)
          creditAmount: amount,
          status: 'COMPLETED',
          squarePaymentId,
          squareOrderId,
          description: description || `Purchased ${amount} credits`,
        },
      });

      return { user, transaction };
    });

    return result;
  }

  async deductCredits(
    userId: string,
    amount: number,
    tournamentId?: string,
    description?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });

    if (!user || user.credits < amount) {
      throw new BadRequestException('Insufficient credits');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct credits
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: amount } },
        select: { id: true, credits: true },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          tournamentId,
          type: 'ENTRY_FEE',
          amount: amount / 100,
          creditAmount: -amount,
          status: 'COMPLETED',
          description: description || `Tournament entry fee: ${amount} credits`,
        },
      });

      return { user: updatedUser, transaction };
    });

    return result;
  }

  async refundCredits(
    userId: string,
    amount: number,
    tournamentId?: string,
    description?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Add credits back
      const user = await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
        select: { id: true, credits: true },
      });

      // Create refund transaction
      const transaction = await tx.transaction.create({
        data: {
          userId,
          tournamentId,
          type: 'REFUND',
          amount: amount / 100,
          creditAmount: amount,
          status: 'COMPLETED',
          description: description || `Refund: ${amount} credits`,
        },
      });

      return { user, transaction };
    });

    return result;
  }

  async awardPrize(
    userId: string,
    amount: number,
    tournamentId: string,
    placement: number,
  ) {
    if (amount <= 0) {
      return null; // No prize to award
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Add prize credits
      const user = await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
        select: { id: true, credits: true, username: true },
      });

      // Update user stats
      await tx.userStats.upsert({
        where: { userId },
        create: {
          userId,
          totalEarnings: amount / 100,
          tournamentsWon: placement === 1 ? 1 : 0,
        },
        update: {
          totalEarnings: { increment: amount / 100 },
          tournamentsWon: placement === 1 ? { increment: 1 } : undefined,
        },
      });

      // Create prize transaction
      const transaction = await tx.transaction.create({
        data: {
          userId,
          tournamentId,
          type: 'PRIZE_PAYOUT',
          amount: amount / 100,
          creditAmount: amount,
          status: 'COMPLETED',
          description: `${this.getPlacementLabel(placement)} place prize`,
        },
      });

      return { user, transaction };
    });

    return result;
  }

  async getTransactions(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
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

  async adminAddCredits(
    adminId: string,
    targetUserId: string,
    amount: number,
    reason?: string,
  ) {
    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can add credits');
    }

    return this.addCredits(
      targetUserId,
      amount,
      reason || `Admin credit grant by ${adminId}`,
    );
  }

  private getPlacementLabel(placement: number): string {
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
