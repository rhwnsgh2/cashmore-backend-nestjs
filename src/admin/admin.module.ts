import { Module } from '@nestjs/common';
import { AdminNaverPayController } from './admin-naver-pay.controller';
import { AdminCashExchangeController } from './admin-cash-exchange.controller';
import { AdminAdvertiserController } from './admin-advertiser.controller';
import { AdminBannerAdController } from './admin-banner-ad.controller';
import { AdminEveryReceiptController } from './admin-every-receipt.controller';
import { AdminInvitationPartnerController } from './admin-invitation-partner.controller';
import { AdminUserController } from './admin-user.controller';
import { AdminSmartconController } from './admin-smartcon.controller';
import { AdminGifticonController } from './admin-gifticon.controller';
import { AdminPointController } from './admin-point.controller';
import { NaverPayModule } from '../naver-pay/naver-pay.module';
import { PointModule } from '../point/point.module';
import { ExchangePointModule } from '../exchange-point/exchange-point.module';
import { AdvertiserAuthModule } from '../advertiser-auth/advertiser-auth.module';
import { BannerAdModule } from '../banner-ad/banner-ad.module';
import { EveryReceiptModule } from '../every-receipt/every-receipt.module';
import { InvitationModule } from '../invitation/invitation.module';
import { SmartconModule } from '../smartcon/smartcon.module';
import { GifticonModule } from '../gifticon/gifticon.module';

@Module({
  imports: [
    NaverPayModule,
    ExchangePointModule,
    AdvertiserAuthModule,
    BannerAdModule,
    EveryReceiptModule,
    InvitationModule,
    SmartconModule,
    GifticonModule,
    PointModule,
  ],
  controllers: [
    AdminNaverPayController,
    AdminCashExchangeController,
    AdminAdvertiserController,
    AdminBannerAdController,
    AdminEveryReceiptController,
    AdminInvitationPartnerController,
    AdminUserController,
    AdminSmartconController,
    AdminGifticonController,
    AdminPointController,
  ],
})
export class AdminModule {}
