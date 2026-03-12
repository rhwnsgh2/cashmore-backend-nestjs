import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';
import { SupabaseUserRepository } from './repositories/supabase-user.repository';
import { AuthModule } from '../auth/auth.module';
import { UserModalModule } from '../user-modal/user-modal.module';

@Module({
  imports: [AuthModule, UserModalModule],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: USER_REPOSITORY,
      useClass: SupabaseUserRepository,
    },
  ],
  exports: [UserService],
})
export class UserModule {}
