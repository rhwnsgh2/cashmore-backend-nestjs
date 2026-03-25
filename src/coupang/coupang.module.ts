import { Module } from '@nestjs/common';
import { CoupangController } from './coupang.controller';
import { CoupangService } from './coupang.service';
import { COUPANG_VISIT_REPOSITORY } from './interfaces/coupang-visit-repository.interface';
import { SupabaseCoupangVisitRepository } from './repositories/supabase-coupang-visit.repository';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [CoupangController],
  providers: [
    CoupangService,
    {
      provide: COUPANG_VISIT_REPOSITORY,
      useClass: SupabaseCoupangVisitRepository,
    },
  ],
})
export class CoupangModule {}
