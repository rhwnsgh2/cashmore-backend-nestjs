import { Module } from '@nestjs/common';
import { AdvertiserAuthController } from './advertiser-auth.controller';
import { AdvertiserAuthService } from './advertiser-auth.service';
import { ADVERTISER_AUTH_REPOSITORY } from './interfaces/advertiser-auth-repository.interface';
import { SupabaseAdvertiserAuthRepository } from './repositories/supabase-advertiser-auth.repository';
import { AdvertiserJwtAuthGuard } from './guards/advertiser-jwt-auth.guard';

@Module({
  controllers: [AdvertiserAuthController],
  providers: [
    AdvertiserAuthService,
    {
      provide: ADVERTISER_AUTH_REPOSITORY,
      useClass: SupabaseAdvertiserAuthRepository,
    },
    AdvertiserJwtAuthGuard,
  ],
  exports: [AdvertiserAuthService, AdvertiserJwtAuthGuard],
})
export class AdvertiserAuthModule {}
