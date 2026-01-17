import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let _prismaService: PrismaService;
  let _jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    _prismaService = module.get<PrismaService>(PrismaService);
    _jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const email = 'test@example.com';
    const username = 'testuser';
    const password = 'Password123!';

    it('should register a new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: '1',
        email,
        username,
        role: 'USER',
        tier: 'FREE',
      });

      const result = await service.register(email, username, password);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(email);
    });

    it('should throw if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ email });

      await expect(service.register(email, username, password)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if username already exists', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ username }); // username check

      await expect(service.register(email, username, password)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    const email = 'test@example.com';
    const password = 'Password123!';

    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash(password, 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        username: 'testuser',
        passwordHash: hashedPassword,
        role: 'USER',
        tier: 'FREE',
      });

      const result = await service.login(email, password);

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe(email);
    });

    it('should throw if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email,
        passwordHash: await bcrypt.hash('differentpassword', 10),
        role: 'USER',
        tier: 'FREE',
      });

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens for valid user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'USER',
        tier: 'FREE',
      });

      const result = await service.refreshToken('1');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
