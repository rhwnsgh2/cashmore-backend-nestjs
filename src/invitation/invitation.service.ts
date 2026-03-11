import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { StepRewardResponseDto } from './dto/step-reward.dto';

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

    const stepRewards = await this.invitationRepository.findStepRewards(userId);
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

  async claimStepReward(
    userId: string,
    stepCount: number,
  ): Promise<StepRewardResponseDto> {
    const invitationId =
      await this.invitationRepository.findInvitationIdByUserId(userId);

    if (invitationId === null) {
      return { success: false, error: 'Invitation not found' };
    }

    // 초대 수 확인
    const currentCount = await this.invitationRepository.countInvitedUsersSince(
      invitationId,
      INVITATION_STEP_START_DATE,
    );

    if (currentCount < stepCount) {
      throw new BadRequestException('Current count is less than step count');
    }

    // 해당 단계가 존재하는지 확인
    const eligibleStep = INVITATION_STEPS.find((s) => s.count === stepCount);

    if (!eligibleStep) {
      throw new BadRequestException('Eligible step not found');
    }

    // 이미 수령했는지 확인
    const alreadyReceived = await this.invitationRepository.hasStepReward(
      userId,
      stepCount,
    );

    if (alreadyReceived) {
      throw new ConflictException('Already received step reward');
    }

    // 보상 지급
    await this.invitationRepository.createStepReward(
      userId,
      eligibleStep.amount,
      eligibleStep.count,
      eligibleStep.reward,
    );

    return { success: true };
  }
}
