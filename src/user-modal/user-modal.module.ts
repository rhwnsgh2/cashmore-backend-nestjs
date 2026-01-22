import { Module } from '@nestjs/common';
import { UserModalController } from './user-modal.controller';
import { UserModalService } from './user-modal.service';
import { USER_MODAL_REPOSITORY } from './interfaces/user-modal-repository.interface';
import { SupabaseUserModalRepository } from './repositories/supabase-user-modal.repository';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [UserModalController],
  providers: [
    UserModalService,
    {
      provide: USER_MODAL_REPOSITORY,
      useClass: SupabaseUserModalRepository,
    },
  ],
})
export class UserModalModule {}
