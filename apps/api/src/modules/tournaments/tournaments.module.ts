import { Module, forwardRef } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { BracketService } from './bracket.service';
import { EventsModule } from '../events/events.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [EventsModule, forwardRef(() => PaymentsModule)],
  controllers: [TournamentsController],
  providers: [TournamentsService, BracketService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
