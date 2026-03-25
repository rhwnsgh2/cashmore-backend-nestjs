import { Module } from '@nestjs/common';
import { AccountInfoController } from './account-info.controller';
import { AccountInfoService } from './account-info.service';
import { ACCOUNT_INFO_REPOSITORY } from './interfaces/account-info-repository.interface';
import { SupabaseAccountInfoRepository } from './repositories/supabase-account-info.repository';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [AccountInfoController],
  providers: [
    AccountInfoService,
    {
      provide: ACCOUNT_INFO_REPOSITORY,
      useClass: SupabaseAccountInfoRepository,
    },
  ],
})
export class AccountInfoModule {}
