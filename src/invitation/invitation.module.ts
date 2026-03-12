import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';
import { SlackModule } from '../slack/slack.module';
import { UserModalModule } from '../user-modal/user-modal.module';
import { InvitationController } from './invitation.controller';
import { InvitationStepEventController } from './invitation-step-event.controller';
import { InvitationStepRewardController } from './invitation-step-reward.controller';
import { InvitationService } from './invitation.service';
import { INVITATION_REPOSITORY } from './interfaces/invitation-repository.interface';
import { SupabaseInvitationRepository } from './repositories/supabase-invitation.repository';

@Module({
  imports: [AuthModule, FcmModule, SlackModule, UserModalModule],
  controllers: [
    InvitationController,
    InvitationStepEventController,
    InvitationStepRewardController,
  ],
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
