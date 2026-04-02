import { Module } from '@nestjs/common';
import { AdminNaverPayController } from './admin-naver-pay.controller';
import { AdminCashExchangeController } from './admin-cash-exchange.controller';
import { NaverPayModule } from '../naver-pay/naver-pay.module';
import { ExchangePointModule } from '../exchange-point/exchange-point.module';

@Module({
  imports: [NaverPayModule, ExchangePointModule],
  controllers: [AdminNaverPayController, AdminCashExchangeController],
})
export class AdminModule {}
