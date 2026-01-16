import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import Stripe from 'stripe';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create checkout session for tournament entry
   */
  @Post('tournaments/:tournamentId/checkout')
  @UseGuards(JwtAuthGuard)
  async createTournamentCheckout(
    @Param('tournamentId') tournamentId: string,
    @Request() req: any,
  ) {
    return this.paymentsService.createTournamentEntryCheckout(
      tournamentId,
      req.user.id,
    );
  }

  /**
   * Get user's transaction history
   */
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async getUserTransactions(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.paymentsService.getUserTransactions(req.user.id, {
      page,
      pageSize,
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
   * Request refund for tournament entry
   */
  @Post('tournaments/:tournamentId/refund')
  @UseGuards(JwtAuthGuard)
  async refundEntry(
    @Param('tournamentId') tournamentId: string,
    @Body('userId') userId: string,
    @Request() req: any,
  ) {
    // If no userId specified, refund the requester's entry
    const targetUserId = userId || req.user.id;
    await this.paymentsService.refundEntry(
      tournamentId,
      targetUserId,
      req.user.id,
    );
    return { message: 'Refund processed successfully' };
  }

  /**
   * Stripe webhook endpoint
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    if (!req.rawBody) {
      throw new BadRequestException('No raw body available');
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(
        req.rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === 'tournament_entry') {
          await this.paymentsService.handlePaymentSuccess(session);
        }
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === 'tournament_entry') {
          await this.paymentsService.handlePaymentFailed(session);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}
