import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { INVITATION_REPOSITORY } from './interfaces/invitation-repository.interface';
import { SupabaseInvitationRepository } from './repositories/supabase-invitation.repository';

@Module({
  imports: [AuthModule],
  controllers: [InvitationController],
  providers: [
    InvitationService,
    {
      provide: INVITATION_REPOSITORY,
      useClass: SupabaseInvitationRepository,
    },
  ],
  exports: [InvitationService],
})
export class InvitationModule {}
