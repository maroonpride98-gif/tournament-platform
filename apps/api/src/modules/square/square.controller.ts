import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Request,
  UseGuards,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SquareService } from './square.service';
import { WalletService } from '../wallet/wallet.service';
import { ConfigService } from '@nestjs/config';

@Controller('square')
export class SquareController {
  constructor(
    private squareService: SquareService,
    private walletService: WalletService,
    private configService: ConfigService,
  ) {}

  @Get('packages')
  getPackages() {
    return this.squareService.getCreditPackages();
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @Request() req,
    @Body() body: { packageId: string },
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/wallet?payment=success`;

    const result = await this.squareService.createCheckoutLink(
      req.user.id,
      body.packageId,
      redirectUrl,
    );

    return result;
  }

  @Post('webhook')
  @SkipThrottle()
  async handleWebhook(
    @Headers('x-square-hmacsha256-signature') signature: string,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // Get the webhook URL for verification
    const webhookUrl = this.configService.get<string>('SQUARE_WEBHOOK_URL') || '';

    // Always verify webhook signature
    const rawBody = JSON.stringify(body);
    if (!this.squareService.verifyWebhookSignature(signature, rawBody, webhookUrl)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = this.squareService.parseWebhookEvent(body);

    // Handle payment completed events
    if (
      event.type === 'order.fulfillment.updated' ||
      event.type === 'payment.completed'
    ) {
      await this.handlePaymentCompleted(event);
    }

    return { received: true };
  }

  private async handlePaymentCompleted(event: {
    type: string;
    orderId?: string;
    paymentId?: string;
    metadata?: Record<string, string>;
  }) {
    if (!event.orderId) {
      return;
    }

    // Get order details to retrieve metadata
    const order = await this.squareService.getOrder(event.orderId);
    if (!order) {
      return;
    }

    const metadata = order.metadata;
    if (!metadata || metadata.type !== 'credit_purchase') {
      return;
    }

    const userId = metadata.userId;
    const credits = parseInt(metadata.credits || '0');

    if (!userId || credits <= 0) {
      return;
    }

    // Check if already processed (idempotency)
    // We use the orderId as the squareOrderId in transactions
    try {
      await this.walletService.addCredits(
        userId,
        credits,
        `Purchased ${credits} credits`,
        event.paymentId,
        event.orderId,
      );
    } catch (error) {
      // Silently fail - likely duplicate webhook or already processed
    }
  }
}
