import { Module } from '@nestjs/common';
import { DividendController } from './dividend.controller';
import { DividendService } from './dividend.service';
import { DIVIDEND_REPOSITORY } from './interfaces/dividend-repository.interface';
import { SupabaseDividendRepository } from './repositories/supabase-dividend.repository';

@Module({
  controllers: [DividendController],
  providers: [
    DividendService,
    {
      provide: DIVIDEND_REPOSITORY,
      useClass: SupabaseDividendRepository,
    },
  ],
})
export class DividendModule {}
