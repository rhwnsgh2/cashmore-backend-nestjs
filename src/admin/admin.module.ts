import { Module } from '@nestjs/common';
import { AdminNaverPayController } from './admin-naver-pay.controller';
import { AdminCashExchangeController } from './admin-cash-exchange.controller';
import { AdminAdvertiserController } from './admin-advertiser.controller';
import { AdminBannerAdController } from './admin-banner-ad.controller';
import { AdminEveryReceiptController } from './admin-every-receipt.controller';
import { NaverPayModule } from '../naver-pay/naver-pay.module';
import { ExchangePointModule } from '../exchange-point/exchange-point.module';
import { AdvertiserAuthModule } from '../advertiser-auth/advertiser-auth.module';
import { BannerAdModule } from '../banner-ad/banner-ad.module';
import { EveryReceiptModule } from '../every-receipt/every-receipt.module';

@Module({
  imports: [
    NaverPayModule,
    ExchangePointModule,
    AdvertiserAuthModule,
    BannerAdModule,
    EveryReceiptModule,
  ],
  controllers: [
    AdminNaverPayController,
    AdminCashExchangeController,
    AdminAdvertiserController,
    AdminBannerAdController,
    AdminEveryReceiptController,
  ],
})
export class AdminModule {}
