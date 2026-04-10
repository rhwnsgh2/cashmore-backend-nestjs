import { Module } from '@nestjs/common';
import { AdminNaverPayController } from './admin-naver-pay.controller';
import { AdminCashExchangeController } from './admin-cash-exchange.controller';
import { AdminAdvertiserController } from './admin-advertiser.controller';
import { NaverPayModule } from '../naver-pay/naver-pay.module';
import { ExchangePointModule } from '../exchange-point/exchange-point.module';
import { AdvertiserAuthModule } from '../advertiser-auth/advertiser-auth.module';

@Module({
  imports: [NaverPayModule, ExchangePointModule, AdvertiserAuthModule],
  controllers: [
    AdminNaverPayController,
    AdminCashExchangeController,
    AdminAdvertiserController,
  ],
})
export class AdminModule {}
