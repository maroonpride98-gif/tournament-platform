import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Process refunds for all paid participants in a tournament
   */
  private async processParticipantRefunds(tournamentId: string, tournamentName: string): Promise<number> {
    // Find all entry fee transactions for this tournament
    const entryFeeTransactions = await this.prisma.transaction.findMany({
      where: {
        tournamentId,
        type: 'ENTRY_FEE',
        status: 'COMPLETED',
      },
    });

    let refundCount = 0;

    for (const transaction of entryFeeTransactions) {
      const creditsToRefund = Math.round(transaction.amount * 100);

      await this.prisma.$transaction(async (tx) => {
        // Refund credits to user
        await tx.user.update({
          where: { id: transaction.userId },
          data: { credits: { increment: creditsToRefund } },
        });

        // Update original transaction status
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'REFUNDED' },
        });

        // Create refund transaction record
        await tx.transaction.create({
          data: {
            userId: transaction.userId,
            tournamentId,
            type: 'REFUND',
            amount: transaction.amount,
            creditAmount: creditsToRefund,
            status: 'COMPLETED',
            description: `Refund for cancelled tournament: ${tournamentName}`,
          },
        });
      });

      refundCount++;
    }

    return refundCount;
  }

  async getStats() {
    const [
      totalUsers,
      totalTournaments,
      activeTournaments,
      totalGames,
      prizePoolResult,
      recentSignups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tournament.count(),
      this.prisma.tournament.count({
        where: { status: { in: ['REGISTRATION_OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.game.count(),
      this.prisma.tournament.aggregate({
        _sum: { prizePool: true },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      totalUsers,
      totalTournaments,
      activeTournaments,
      totalGames,
      totalPrizePool: prizePoolResult._sum.prizePool || 0,
      recentSignups,
    };
  }

  async getRecentTournaments() {
    const tournaments = await this.prisma.tournament.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { participants: true } },
      },
    });

    return tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      startDate: t.startDate,
      participantCount: t._count.participants,
      prizePool: t.prizePool,
    }));
  }

  async getTournaments(options: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, status, search } = options;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [tournaments, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          game: { select: { name: true } },
          createdBy: { select: { username: true } },
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      items: tournaments,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async cancelTournament(tournamentId: string, _adminId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new ForbiddenException('Tournament not found');
    }

    if (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') {
      throw new ForbiddenException('Cannot cancel a completed or already cancelled tournament');
    }

    // Cancel the tournament
    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: 'CANCELLED',
        prizePool: 0, // Reset prize pool since all entry fees are refunded
      },
    });

    // Process refunds for all participants if paid tournament
    let refundCount = 0;
    if (tournament.entryFee > 0) {
      refundCount = await this.processParticipantRefunds(tournamentId, tournament.name);
    }

    return {
      message: 'Tournament cancelled successfully',
      refundsProcessed: refundCount,
    };
  }

  async getUsers(options: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
  }) {
    const { page = 1, pageSize = 20, search, role } = options;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (role) {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          tier: true,
          createdAt: true,
          _count: {
            select: {
              participations: true,
              teamMemberships: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateUserRole(userId: string, role: 'USER' | 'ORGANIZER' | 'ADMIN') {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
  }

  async getGames(options: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = options;
    const skip = (page - 1) * pageSize;

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { tournaments: true, teams: true },
          },
        },
      }),
      this.prisma.game.count(),
    ]);

    return {
      items: games,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get transaction statistics for admin dashboard
   */
  async getTransactionStats() {
    const [
      totalTransactions,
      creditPurchases,
      entryFees,
      prizePayouts,
      refunds,
      recentVolume,
    ] = await Promise.all([
      this.prisma.transaction.count(),
      this.prisma.transaction.aggregate({
        where: { type: 'CREDIT_PURCHASE', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'ENTRY_FEE', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'PRIZE_PAYOUT', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'REFUND', status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      // Last 30 days volume
      this.prisma.transaction.aggregate({
        where: {
          type: 'CREDIT_PURCHASE',
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalTransactions,
      creditPurchases: {
        count: creditPurchases._count,
        total: creditPurchases._sum.amount || 0,
      },
      entryFees: {
        count: entryFees._count,
        total: entryFees._sum.amount || 0,
      },
      prizePayouts: {
        count: prizePayouts._count,
        total: prizePayouts._sum.amount || 0,
      },
      refunds: {
        count: refunds._count,
        total: refunds._sum.amount || 0,
      },
      last30DaysRevenue: recentVolume._sum.amount || 0,
    };
  }

  /**
   * Get paginated transactions with filters
   */
  async getTransactions(options: {
    page?: number;
    pageSize?: number;
    type?: string;
    status?: string;
    userId?: string;
    tournamentId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, pageSize = 20, type, status, userId, tournamentId, startDate, endDate } = options;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (tournamentId) where.tournamentId = tournamentId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, email: true } },
          tournament: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
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
   * Get payment report for a date range
   */
  async getPaymentReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: { gte: start, lte: end },
      status: 'COMPLETED' as const,
    };

    const [
      creditPurchases,
      entryFees,
      prizePayouts,
      refunds,
      dailyRevenue,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...dateFilter, type: 'CREDIT_PURCHASE' as const },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { ...dateFilter, type: 'ENTRY_FEE' as const },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { ...dateFilter, type: 'PRIZE_PAYOUT' as const },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { ...dateFilter, type: 'REFUND' as const },
        _sum: { amount: true },
        _count: true,
      }),
      // Group by day
      this.prisma.transaction.groupBy({
        by: ['createdAt'],
        where: { ...dateFilter, type: 'CREDIT_PURCHASE' as const },
        _sum: { amount: true },
      }),
    ]);

    // Calculate platform revenue (entry fees collected minus prize payouts)
    const entryFeeTotal = entryFees._sum?.amount || 0;
    const prizePayoutTotal = prizePayouts._sum?.amount || 0;
    const platformRevenue = entryFeeTotal - prizePayoutTotal;

    return {
      period: { startDate, endDate },
      creditPurchases: {
        count: creditPurchases._count,
        total: creditPurchases._sum?.amount || 0,
      },
      entryFees: {
        count: entryFees._count,
        total: entryFeeTotal,
      },
      prizePayouts: {
        count: prizePayouts._count,
        total: prizePayoutTotal,
      },
      refunds: {
        count: refunds._count,
        total: refunds._sum?.amount || 0,
      },
      platformRevenue,
      grossRevenue: creditPurchases._sum?.amount || 0,
    };
  }
}
