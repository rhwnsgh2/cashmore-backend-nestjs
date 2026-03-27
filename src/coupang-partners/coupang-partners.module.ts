import { Module } from '@nestjs/common';
import { CoupangPartnersController } from './coupang-partners.controller';
import { CoupangPartnersService } from './coupang-partners.service';
import { COUPANG_POSTBACK_REPOSITORY } from './interfaces/coupang-postback-repository.interface';
import { SupabaseCoupangPostbackRepository } from './repositories/supabase-coupang-postback.repository';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CoupangPartnersController],
  providers: [
    CoupangPartnersService,
    {
      provide: COUPANG_POSTBACK_REPOSITORY,
      useClass: SupabaseCoupangPostbackRepository,
    },
  ],
})
export class CoupangPartnersModule {}
