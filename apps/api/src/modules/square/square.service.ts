import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SquareClient, SquareEnvironment } from 'square';
import { randomUUID } from 'crypto';

export interface CreditPackage {
  id: string;
  name: string;
  priceInCents: number;
  credits: number;
  bonus: number;
  popular?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter', name: 'Starter', priceInCents: 500, credits: 500, bonus: 0 },
  { id: 'basic', name: 'Basic', priceInCents: 1000, credits: 1000, bonus: 0 },
  { id: 'plus', name: 'Plus', priceInCents: 2500, credits: 2500, bonus: 250, popular: true },
  { id: 'pro', name: 'Pro', priceInCents: 5000, credits: 5000, bonus: 1000 },
  { id: 'elite', name: 'Elite', priceInCents: 10000, credits: 10000, bonus: 3000 },
];

@Injectable()
export class SquareService {
  private client: SquareClient;
  private locationId: string;

  constructor(private configService: ConfigService) {
    const accessToken = this.configService.get<string>('SQUARE_ACCESS_TOKEN');
    const environment = this.configService.get<string>('SQUARE_ENVIRONMENT');

    this.client = new SquareClient({
      token: accessToken,
      environment:
        environment === 'production'
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });

    this.locationId = this.configService.get<string>('SQUARE_LOCATION_ID') || '';
  }

  getCreditPackages() {
    // Transform to frontend format (price in dollars)
    return CREDIT_PACKAGES.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.priceInCents / 100, // Convert cents to dollars
      credits: pkg.credits,
      bonus: pkg.bonus,
      popular: pkg.popular || false,
    }));
  }

  getPackageById(packageId: string): CreditPackage | undefined {
    return CREDIT_PACKAGES.find((p) => p.id === packageId);
  }

  async createCheckoutLink(
    userId: string,
    packageId: string,
    redirectUrl: string,
  ): Promise<{ checkoutUrl: string; orderId: string }> {
    const creditPackage = this.getPackageById(packageId);
    if (!creditPackage) {
      throw new BadRequestException('Invalid package selected');
    }

    const idempotencyKey = randomUUID();
    const totalCredits = creditPackage.credits + creditPackage.bonus;

    try {
      const response = await this.client.checkout.paymentLinks.create({
        idempotencyKey,
        order: {
          locationId: this.locationId,
          lineItems: [
            {
              name: `${creditPackage.name} Credit Pack - ${totalCredits} Credits`,
              quantity: '1',
              basePriceMoney: {
                amount: BigInt(creditPackage.priceInCents),
                currency: 'USD',
              },
            },
          ],
          metadata: {
            userId,
            packageId,
            credits: totalCredits.toString(),
            type: 'credit_purchase',
          },
        },
        checkoutOptions: {
          redirectUrl,
          askForShippingAddress: false,
        },
      });

      const paymentLink = response.paymentLink;
      if (!paymentLink?.url || !paymentLink?.orderId) {
        throw new BadRequestException('Failed to create checkout link');
      }

      return {
        checkoutUrl: paymentLink.url,
        orderId: paymentLink.orderId,
      };
    } catch (error: any) {
      console.error('Square checkout error:', error);
      throw new BadRequestException(
        error.message || 'Failed to create checkout',
      );
    }
  }

  async getPayment(paymentId: string) {
    try {
      const response = await this.client.payments.get({ paymentId });
      return response.payment;
    } catch (error) {
      console.error('Failed to get payment:', error);
      return null;
    }
  }

  async getOrder(orderId: string) {
    try {
      const response = await this.client.orders.get({ orderId });
      return response.order;
    } catch (error) {
      console.error('Failed to get order:', error);
      return null;
    }
  }

  verifyWebhookSignature(
    signature: string,
    body: string,
    url: string,
  ): boolean {
    const webhookSignatureKey = this.configService.get<string>(
      'SQUARE_WEBHOOK_SIGNATURE_KEY',
    );

    if (!webhookSignatureKey) {
      throw new Error('SQUARE_WEBHOOK_SIGNATURE_KEY environment variable is required');
    }

    // Square uses HMAC-SHA256 for webhook verification
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', webhookSignatureKey);
    hmac.update(url + body);
    const expectedSignature = hmac.digest('base64');

    return signature === expectedSignature;
  }

  parseWebhookEvent(body: any): {
    type: string;
    orderId?: string;
    paymentId?: string;
    metadata?: Record<string, string>;
  } {
    const eventType = body.type;
    let orderId: string | undefined;
    let paymentId: string | undefined;
    let metadata: Record<string, string> | undefined;

    if (body.data?.object?.order) {
      orderId = body.data.object.order.id;
      metadata = body.data.object.order.metadata;
    }

    if (body.data?.object?.payment) {
      paymentId = body.data.object.payment.id;
      orderId = body.data.object.payment.order_id;
    }

    return { type: eventType, orderId, paymentId, metadata };
  }
}
