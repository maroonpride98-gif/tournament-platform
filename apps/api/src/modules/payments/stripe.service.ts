import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2023-10-16',
      });
    }
  }

  getClient(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in environment.');
    }
    return this.stripe;
  }

  /**
   * Create a checkout session for tournament entry fee
   */
  async createCheckoutSession(params: {
    tournamentId: string;
    tournamentName: string;
    userId: string;
    amount: number; // in dollars
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    const stripe = this.getClient();

    return stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Tournament Entry: ${params.tournamentName}`,
              description: 'Entry fee for tournament registration',
            },
            unit_amount: Math.round(params.amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'tournament_entry',
        tournamentId: params.tournamentId,
        userId: params.userId,
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }

  /**
   * Create a Stripe Connect account for organizers to receive payouts
   */
  async createConnectAccount(params: {
    userId: string;
    email: string;
    country?: string;
  }): Promise<Stripe.Account> {
    const stripe = this.getClient();

    return stripe.accounts.create({
      type: 'express',
      country: params.country || 'US',
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        userId: params.userId,
      },
    });
  }

  /**
   * Create account link for onboarding
   */
  async createAccountLink(params: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<Stripe.AccountLink> {
    const stripe = this.getClient();

    return stripe.accountLinks.create({
      account: params.accountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: 'account_onboarding',
    });
  }

  /**
   * Transfer prize money to winner's connected account
   */
  async createTransfer(params: {
    amount: number; // in dollars
    destinationAccountId: string;
    tournamentId: string;
    description: string;
  }): Promise<Stripe.Transfer> {
    const stripe = this.getClient();

    return stripe.transfers.create({
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: 'usd',
      destination: params.destinationAccountId,
      metadata: {
        tournamentId: params.tournamentId,
      },
      description: params.description,
    });
  }

  /**
   * Create a payout to a connected account's bank
   */
  async createPayout(params: {
    amount: number;
    accountId: string;
  }): Promise<Stripe.Payout> {
    const stripe = this.getClient();

    return stripe.payouts.create(
      {
        amount: Math.round(params.amount * 100),
        currency: 'usd',
      },
      {
        stripeAccount: params.accountId,
      },
    );
  }

  /**
   * Retrieve account details
   */
  async getAccount(accountId: string): Promise<Stripe.Account> {
    const stripe = this.getClient();
    return stripe.accounts.retrieve(accountId);
  }

  /**
   * Get account balance
   */
  async getBalance(accountId?: string): Promise<Stripe.Balance> {
    const stripe = this.getClient();
    if (accountId) {
      return stripe.balance.retrieve({ stripeAccount: accountId });
    }
    return stripe.balance.retrieve();
  }

  /**
   * Verify webhook signature
   */
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    const stripe = this.getClient();
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Refund a payment
   */
  async createRefund(params: {
    paymentIntentId: string;
    amount?: number; // Optional partial refund amount in dollars
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }): Promise<Stripe.Refund> {
    const stripe = this.getClient();

    return stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount ? Math.round(params.amount * 100) : undefined,
      reason: params.reason,
    });
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    const stripe = this.getClient();
    return stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
  }
}
