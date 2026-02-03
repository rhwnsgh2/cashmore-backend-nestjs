import { Module } from '@nestjs/common';
import { InviteCodeController } from './invite-code.controller';
import { InviteCodeService } from './invite-code.service';
import { INVITE_CODE_REPOSITORY } from './interfaces/invite-code-repository.interface';
import { SupabaseInviteCodeRepository } from './repositories/supabase-invite-code.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InviteCodeController],
  providers: [
    InviteCodeService,
    {
      provide: INVITE_CODE_REPOSITORY,
      useClass: SupabaseInviteCodeRepository,
    },
  ],
})
export class InviteCodeModule {}
