import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { GamesModule } from './modules/games/games.module';
import { TeamsModule } from './modules/teams/teams.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TournamentsModule,
    GamesModule,
    TeamsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
