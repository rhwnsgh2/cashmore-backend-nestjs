import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SmartconModule } from '../smartcon/smartcon.module';
import { AuthModule } from '../auth/auth.module';
import { GifticonService } from './gifticon.service';
import { GifticonController } from './gifticon.controller';
import { GIFTICON_PRODUCT_REPOSITORY } from './interfaces/gifticon-product-repository.interface';
import { SupabaseGifticonProductRepository } from './repositories/supabase-gifticon-product.repository';

@Module({
  imports: [SupabaseModule, SmartconModule, AuthModule],
  controllers: [GifticonController],
  providers: [
    GifticonService,
    {
      provide: GIFTICON_PRODUCT_REPOSITORY,
      useClass: SupabaseGifticonProductRepository,
    },
  ],
  exports: [GifticonService],
})
export class GifticonModule {}
