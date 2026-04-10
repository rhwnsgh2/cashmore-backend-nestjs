import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { BannerAdController } from './banner-ad.controller';
import { BannerAdService } from './banner-ad.service';
import { BANNER_AD_REPOSITORY } from './interfaces/banner-ad-repository.interface';
import { SupabaseBannerAdRepository } from './repositories/supabase-banner-ad.repository';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [BannerAdController],
  providers: [
    BannerAdService,
    {
      provide: BANNER_AD_REPOSITORY,
      useClass: SupabaseBannerAdRepository,
    },
  ],
})
export class BannerAdModule {}
