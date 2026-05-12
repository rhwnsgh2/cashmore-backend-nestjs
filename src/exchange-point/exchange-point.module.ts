import { Module } from '@nestjs/common';
import { ExchangePointController } from './exchange-point.controller';
import { ExchangePointService } from './exchange-point.service';
import { EXCHANGE_POINT_REPOSITORY } from './interfaces/exchange-point-repository.interface';
import { SupabaseExchangePointRepository } from './repositories/supabase-exchange-point.repository';
import { CASH_EXCHANGE_REPOSITORY } from './interfaces/cash-exchange-repository.interface';
import { SupabaseCashExchangeRepository } from './repositories/supabase-cash-exchange.repository';
import { AuthModule } from '../auth/auth.module';
import { UserModalModule } from '../user-modal/user-modal.module';
import { FcmModule } from '../fcm/fcm.module';
import { UserModule } from '../user/user.module';
import { AccountInfoModule } from '../account-info/account-info.module';
import { PointModule } from '../point/point.module';

@Module({
  imports: [
    AuthModule,
    UserModalModule,
    FcmModule,
    UserModule,
    AccountInfoModule,
    PointModule,
  ],
  controllers: [ExchangePointController],
  providers: [
    ExchangePointService,
    {
      provide: EXCHANGE_POINT_REPOSITORY,
      useClass: SupabaseExchangePointRepository,
    },
    {
      provide: CASH_EXCHANGE_REPOSITORY,
      useClass: SupabaseCashExchangeRepository,
    },
  ],
  exports: [ExchangePointService],
})
export class ExchangePointModule {}
