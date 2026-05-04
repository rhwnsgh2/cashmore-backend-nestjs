import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { UserInfoController } from './user-info.controller';
import { UserInfoService } from './user-info.service';
import { USER_INFO_REPOSITORY } from './interfaces/user-info-repository.interface';
import { SupabaseUserInfoRepository } from './repositories/supabase-user-info.repository';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [UserInfoController],
  providers: [
    UserInfoService,
    {
      provide: USER_INFO_REPOSITORY,
      useClass: SupabaseUserInfoRepository,
    },
  ],
  exports: [UserInfoService, USER_INFO_REPOSITORY],
})
export class UserInfoModule {}
