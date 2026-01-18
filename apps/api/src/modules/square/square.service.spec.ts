import { Test, TestingModule } from '@nestjs/testing';
import { SquareService, CREDIT_PACKAGES } from './square.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('SquareService', () => {
  let service: SquareService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        SQUARE_ACCESS_TOKEN: 'test-token',
        SQUARE_ENVIRONMENT: 'sandbox',
        SQUARE_LOCATION_ID: 'test-location',
        SQUARE_WEBHOOK_SIGNATURE_KEY: 'test-signature-key',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquareService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SquareService>(SquareService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCreditPackages', () => {
    it('should return formatted credit packages', () => {
      const packages = service.getCreditPackages();

      expect(packages).toHaveLength(5);
      expect(packages[0]).toEqual({
        id: 'starter',
        name: 'Starter',
        price: 5, // $5.00
        credits: 500,
        bonus: 0,
        popular: false,
      });
    });

    it('should mark Plus package as popular', () => {
      const packages = service.getCreditPackages();
      const plusPackage = packages.find((p) => p.id === 'plus');

      expect(plusPackage?.popular).toBe(true);
    });

    it('should convert cents to dollars', () => {
      const packages = service.getCreditPackages();

      expect(packages[0].price).toBe(5); // 500 cents = $5
      expect(packages[4].price).toBe(100); // 10000 cents = $100
    });
  });

  describe('getPackageById', () => {
    it('should return package by id', () => {
      const pkg = service.getPackageById('pro');

      expect(pkg).toBeDefined();
      expect(pkg?.name).toBe('Pro');
      expect(pkg?.credits).toBe(5000);
    });

    it('should return undefined for invalid id', () => {
      const pkg = service.getPackageById('invalid-package');

      expect(pkg).toBeUndefined();
    });
  });

  describe('parseWebhookEvent', () => {
    it('should parse order fulfillment event', () => {
      const body = {
        type: 'order.fulfillment.updated',
        data: {
          object: {
            order: {
              id: 'order-123',
              metadata: { userId: 'user-1', credits: '1000' },
            },
          },
        },
      };

      const event = service.parseWebhookEvent(body);

      expect(event.type).toBe('order.fulfillment.updated');
      expect(event.orderId).toBe('order-123');
      expect(event.metadata).toEqual({ userId: 'user-1', credits: '1000' });
    });

    it('should parse payment completed event', () => {
      const body = {
        type: 'payment.completed',
        data: {
          object: {
            payment: {
              id: 'payment-123',
              order_id: 'order-456',
            },
          },
        },
      };

      const event = service.parseWebhookEvent(body);

      expect(event.type).toBe('payment.completed');
      expect(event.paymentId).toBe('payment-123');
      expect(event.orderId).toBe('order-456');
    });

    it('should handle events without order or payment data', () => {
      const body = { type: 'some.other.event', data: {} };

      const event = service.parseWebhookEvent(body);

      expect(event.type).toBe('some.other.event');
      expect(event.orderId).toBeUndefined();
      expect(event.paymentId).toBeUndefined();
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should throw error if signature key not configured', () => {
      const configWithoutKey = {
        get: jest.fn(() => undefined),
      };

      const moduleWithoutKey = Test.createTestingModule({
        providers: [
          SquareService,
          { provide: ConfigService, useValue: configWithoutKey },
        ],
      });

      // The constructor should work, but verifyWebhookSignature should throw
      moduleWithoutKey.compile().then((module) => {
        const svc = module.get<SquareService>(SquareService);
        expect(() =>
          svc.verifyWebhookSignature('sig', 'body', 'url'),
        ).toThrow('SQUARE_WEBHOOK_SIGNATURE_KEY environment variable is required');
      });
    });

    it('should verify valid signature', () => {
      const crypto = require('crypto');
      const signatureKey = 'test-signature-key';
      const url = 'https://example.com/webhook';
      const body = '{"test": "data"}';

      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(url + body);
      const expectedSignature = hmac.digest('base64');

      const isValid = service.verifyWebhookSignature(expectedSignature, body, url);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const isValid = service.verifyWebhookSignature(
        'invalid-signature',
        '{"test": "data"}',
        'https://example.com/webhook',
      );

      expect(isValid).toBe(false);
    });
  });

  describe('CREDIT_PACKAGES', () => {
    it('should have correct package structure', () => {
      expect(CREDIT_PACKAGES).toHaveLength(5);

      CREDIT_PACKAGES.forEach((pkg) => {
        expect(pkg).toHaveProperty('id');
        expect(pkg).toHaveProperty('name');
        expect(pkg).toHaveProperty('priceInCents');
        expect(pkg).toHaveProperty('credits');
        expect(pkg).toHaveProperty('bonus');
        expect(pkg.priceInCents).toBeGreaterThan(0);
        expect(pkg.credits).toBeGreaterThan(0);
      });
    });

    it('should have bonus credits for higher tiers', () => {
      const plusPackage = CREDIT_PACKAGES.find((p) => p.id === 'plus');
      const proPackage = CREDIT_PACKAGES.find((p) => p.id === 'pro');
      const elitePackage = CREDIT_PACKAGES.find((p) => p.id === 'elite');

      expect(plusPackage?.bonus).toBe(250);
      expect(proPackage?.bonus).toBe(1000);
      expect(elitePackage?.bonus).toBe(3000);
    });
  });
});
