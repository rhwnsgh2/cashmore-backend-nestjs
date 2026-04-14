import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { AFFILIATE_REPOSITORY } from './interfaces/affiliate-repository.interface';
import { SupabaseAffiliateRepository } from './repositories/supabase-affiliate.repository';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [SlackModule],
  controllers: [AffiliateController],
  providers: [
    AffiliateService,
    {
      provide: AFFILIATE_REPOSITORY,
      useClass: SupabaseAffiliateRepository,
    },
  ],
})
export class AffiliateModule {}
