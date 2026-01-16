import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, username: string, password: string) {
    // Check if email exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      throw new BadRequestException('Email already registered');
    }

    // Check if username exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      throw new BadRequestException('Username already taken');
    }

    const passwordHash = await hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        stats: { create: {} },
      },
    });

    return this.generateTokens(user.id, user.email, user.username, user.role, user.tier);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await compare(password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email, user.username, user.role, user.tier);
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(user.id, user.email, user.username, user.role, user.tier);
  }

  private generateTokens(
    userId: string,
    email: string,
    username: string,
    role: string,
    tier: string,
  ) {
    const payload = {
      sub: userId,
      email,
      username,
      role,
      tier,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '30d' }),
      user: {
        id: userId,
        email,
        username,
        role,
        tier,
      },
    };
  }
}
