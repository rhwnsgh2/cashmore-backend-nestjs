import { Module } from '@nestjs/common';
import { ExchangePointController } from './exchange-point.controller';
import { ExchangePointService } from './exchange-point.service';
import { EXCHANGE_POINT_REPOSITORY } from './interfaces/exchange-point-repository.interface';
import { SupabaseExchangePointRepository } from './repositories/supabase-exchange-point.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ExchangePointController],
  providers: [
    ExchangePointService,
    {
      provide: EXCHANGE_POINT_REPOSITORY,
      useClass: SupabaseExchangePointRepository,
    },
  ],
  exports: [ExchangePointService],
})
export class ExchangePointModule {}
