import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SquareController } from './square.controller';
import { SquareService } from './square.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [ConfigModule, WalletModule],
  controllers: [SquareController],
  providers: [SquareService],
  exports: [SquareService],
})
export class SquareModule {}
