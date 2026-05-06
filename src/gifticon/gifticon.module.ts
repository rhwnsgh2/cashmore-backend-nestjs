import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SmartconModule } from '../smartcon/smartcon.module';
import { AuthModule } from '../auth/auth.module';
import { PointModule } from '../point/point.module';
import { PointWriteModule } from '../point-write/point-write.module';
import { UserInfoModule } from '../user-info/user-info.module';
import { GifticonService } from './gifticon.service';
import { GifticonController } from './gifticon.controller';
import { CouponExchangeService } from './coupon-exchange.service';
import { GIFTICON_PRODUCT_REPOSITORY } from './interfaces/gifticon-product-repository.interface';
import { SupabaseGifticonProductRepository } from './repositories/supabase-gifticon-product.repository';
import { COUPON_EXCHANGE_REPOSITORY } from './interfaces/coupon-exchange-repository.interface';
import { SupabaseCouponExchangeRepository } from './repositories/supabase-coupon-exchange.repository';
import { COUPON_SEND_LOG_REPOSITORY } from './interfaces/coupon-send-log-repository.interface';
import { SupabaseCouponSendLogRepository } from './repositories/supabase-coupon-send-log.repository';

@Module({
  imports: [
    SupabaseModule,
    SmartconModule,
    AuthModule,
    PointModule,
    PointWriteModule,
    UserInfoModule,
  ],
  controllers: [GifticonController],
  providers: [
    GifticonService,
    CouponExchangeService,
    {
      provide: GIFTICON_PRODUCT_REPOSITORY,
      useClass: SupabaseGifticonProductRepository,
    },
    {
      provide: COUPON_EXCHANGE_REPOSITORY,
      useClass: SupabaseCouponExchangeRepository,
    },
    {
      provide: COUPON_SEND_LOG_REPOSITORY,
      useClass: SupabaseCouponSendLogRepository,
    },
  ],
  exports: [
    GifticonService,
    CouponExchangeService,
    COUPON_EXCHANGE_REPOSITORY,
    COUPON_SEND_LOG_REPOSITORY,
  ],
})
export class GifticonModule {}
