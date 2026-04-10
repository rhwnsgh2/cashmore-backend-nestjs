import { Module } from '@nestjs/common';
import { AdvertiserAuthModule } from '../advertiser-auth/advertiser-auth.module';
import { AdvertiserController } from './advertiser.controller';
import { AdvertiserService } from './advertiser.service';
import { ADVERTISER_REPOSITORY } from './interfaces/advertiser-repository.interface';
import { SupabaseAdvertiserRepository } from './repositories/supabase-advertiser.repository';

@Module({
  imports: [AdvertiserAuthModule],
  controllers: [AdvertiserController],
  providers: [
    AdvertiserService,
    {
      provide: ADVERTISER_REPOSITORY,
      useClass: SupabaseAdvertiserRepository,
    },
  ],
})
export class AdvertiserModule {}
