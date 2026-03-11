import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INVITATION_REPOSITORY,
  type IInvitationRepository,
  type Invitation,
} from './interfaces/invitation-repository.interface';
import {
  INVITATION_STEPS,
  INVITATION_STEP_START_DATE,
  POINTS_PER_INVITATION,
} from './constants/invitation-steps';
import type { StepEventResponseDto } from './dto/step-event-response.dto';

@Injectable()
export class InvitationService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private invitationRepository: IInvitationRepository,
  ) {}

  async getOrCreateInvitation(userId: string): Promise<Invitation> {
    return this.invitationRepository.createOrGetInvitation(userId, 'normal');
  }

  async verifyInvitationCode(
    userId: string,
    invitationCode: string,
  ): Promise<{ success: boolean; error?: string }> {
    const invitation =
      await this.invitationRepository.getInvitationByCode(invitationCode);

    if (invitation?.senderId === userId) {
      return {
        success: false,
        error: '본인의 초대 코드는 사용할 수 없습니다.',
      };
    }

    if (invitation === null) {
      return {
        success: false,
        error: '올바른 초대 코드를 입력해주세요',
      };
    }

    return { success: true };
  }

  async getStepEvent(userId: string): Promise<StepEventResponseDto> {
    const invitationId =
      await this.invitationRepository.findInvitationIdByUserId(userId);

    if (invitationId === null) {
      throw new NotFoundException('Invitation not found');
    }

    const invitationCount =
      await this.invitationRepository.countInvitedUsersSince(
        invitationId,
        INVITATION_STEP_START_DATE,
      );

    const stepRewards =
      await this.invitationRepository.findStepRewards(userId);
    const receivedRewards = stepRewards.map((r) => r.stepCount);

    const basePoints = invitationCount * POINTS_PER_INVITATION;
    const stepPoints = receivedRewards.reduce((total, stepCount) => {
      const step = INVITATION_STEPS.find((s) => s.count === stepCount);
      return total + (step?.amount ?? 0);
    }, 0);

    return {
      invitationCount,
      receivedRewards,
      totalPoints: basePoints + stepPoints,
      steps: INVITATION_STEPS,
      success: true,
    };
  }
}
