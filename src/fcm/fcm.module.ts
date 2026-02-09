import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FcmService } from './fcm.service';
import { FCM_REPOSITORY } from './interfaces/fcm-repository.interface';
import { SupabaseFcmRepository } from './repositories/supabase-fcm.repository';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [
    FcmService,
    {
      provide: FCM_REPOSITORY,
      useClass: SupabaseFcmRepository,
    },
  ],
  exports: [FcmService],
})
export class FcmModule {}
