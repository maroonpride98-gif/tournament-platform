import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Pay tournament entry fee with credits
   */
  @Post('tournaments/:tournamentId/pay')
  @UseGuards(JwtAuthGuard)
  async payEntryFee(
    @Param('tournamentId') tournamentId: string,
    @Request() req: any,
  ) {
    return this.paymentsService.payEntryFee(tournamentId, req.user.id);
  }

  /**
   * Get user's transaction history
   */
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getUserTransactions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.paymentsService.getUserTransactions(req.user.id, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
  }

  /**
   * Get tournament transactions (organizer only)
   */
  @Get('tournaments/:tournamentId/transactions')
  @UseGuards(JwtAuthGuard)
  async getTournamentTransactions(
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.paymentsService.getTournamentTransactions(tournamentId);
  }

  /**
   * Request refund for tournament entry (credits returned)
   */
  @Post('tournaments/:tournamentId/refund')
  @UseGuards(JwtAuthGuard)
  async refundEntry(
    @Param('tournamentId') tournamentId: string,
    @Body('userId') userId: string,
    @Request() req: any,
  ) {
    const targetUserId = userId || req.user.id;
    await this.paymentsService.refundEntry(
      tournamentId,
      targetUserId,
      req.user.id,
    );
    return { message: 'Refund processed successfully. Credits returned to wallet.' };
  }

  /**
   * Distribute prizes for a completed tournament (organizer/admin only)
   */
  @Post('tournaments/:tournamentId/distribute-prizes')
  @UseGuards(JwtAuthGuard)
  async distributePrizes(
    @Param('tournamentId') tournamentId: string,
    @Request() req: any,
  ) {
    // Verify user is organizer or admin
    const tournament = await this.paymentsService.getTournamentForPrizeDistribution(
      tournamentId,
      req.user.id,
    );

    const result = await this.paymentsService.distributePrizes(tournamentId);
    return result;
  }
}
