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
  PARTNER_PROGRAM_REPOSITORY,
  type IPartnerProgramRepository,
} from './interfaces/partner-program-repository.interface';
import {
  INVITATION_STEPS,
  INVITATION_STEP_START_DATE,
  PARTNER_INVITATION_STEPS,
  PARTNER_POINTS_PER_INVITATION,
  POINTS_PER_INVITATION,
} from './constants/invitation-steps';
import {
  USER_MODAL_REPOSITORY,
  type IUserModalRepository,
} from '../user-modal/interfaces/user-modal-repository.interface';
import { FcmService } from '../fcm/fcm.service';
import { SlackService } from '../slack/slack.service';
import type { StepEventResponseDto } from './dto/step-event-response.dto';
import type { StepRewardResponseDto } from './dto/step-reward.dto';
import type { LottoProcessResponseDto } from './dto/lotto-process.dto';
import { getRandomRewardPoint } from './utils/random-reward';
import { addSeparator } from './utils/add-separator';
import type { IPointWriteService } from '../point-write/point-write.interface';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';

const RECEIPT_BONUS_POINT = 20;

interface ProcessInvitationRewardParams {
  invitedUserId: string;
  inviteCode: string;
  deviceId?: string;
  signupType?: 'normal' | 'receipt';
  receiptId?: number;
}

@Injectable()
export class InvitationService {
  constructor(
    @Inject(INVITATION_REPOSITORY)
    private invitationRepository: IInvitationRepository,
    @Inject(USER_MODAL_REPOSITORY)
    private userModalRepository: IUserModalRepository,
    private fcmService: FcmService,
    private slackService: SlackService,
    @Inject(POINT_WRITE_SERVICE)
    private pointWriteService: IPointWriteService,
    @Inject(PARTNER_PROGRAM_REPOSITORY)
    private partnerProgramRepository: IPartnerProgramRepository,
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
    await this.pointWriteService.addPoint({
      userId,
      amount: eligibleStep.amount,
      type: 'INVITE_STEP_REWARD',
      additionalData: {
        step_count: eligibleStep.count,
        step_name: eligibleStep.reward,
      },
    });

    return { success: true };
  }

  async processInvitationReward(
    params: ProcessInvitationRewardParams,
  ): Promise<LottoProcessResponseDto> {
    const { invitedUserId, inviteCode, deviceId, signupType, receiptId } =
      params;

    // 1. 초대코드 조회
    const invitation =
      await this.invitationRepository.getInvitationByCode(inviteCode);

    if (!invitation) {
      void this.slackService.reportBugToSlack(
        `초대코드를 넣었지만, 초대한 유저가 삭제된 것 같습니다. ${invitedUserId}, ${inviteCode}`,
      );
      return { success: false, error: '올바른 초대 코드를 입력해주세요' };
    }

    // 2. 본인 초대코드 검증
    if (invitation.senderId === invitedUserId) {
      return {
        success: false,
        error: '본인의 초대 코드는 사용할 수 없습니다.',
      };
    }

    // 3. invitation type이 normal인지 검증
    if (invitation.type !== 'normal') {
      return { success: false, error: '유효하지 않은 초대장입니다.' };
    }

    // 4. deviceId 검증 (DB에서 조회)
    let resolvedDeviceId = deviceId;
    if (!resolvedDeviceId) {
      resolvedDeviceId =
        (await this.invitationRepository.findUserDeviceId(invitedUserId)) ??
        undefined;
    }
    if (!resolvedDeviceId) {
      return { success: false, error: 'deviceId가 필요합니다.' };
    }

    // 5. 가입 후 24시간 이내인지 검증
    const createdAt =
      await this.invitationRepository.findUserCreatedAt(invitedUserId);
    if (createdAt) {
      const hoursSinceCreation =
        (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return {
          success: false,
          error: '가입 후 24시간이 지나 초대 보상을 받을 수 없습니다.',
        };
      }
    }

    // 6. 이미 보상을 받은 디바이스인지 검증 (웹과 동일: DB의 device_id로 체크)
    const alreadyReceivedByDevice =
      await this.invitationRepository.hasDeviceEventParticipation(
        resolvedDeviceId,
        'invitation_reward',
      );
    if (alreadyReceivedByDevice) {
      return {
        success: false,
        error: '이미 초대 보상을 받은 디바이스입니다.',
      };
    }

    // 7. 초대자에게 이미 해당 유저에 대한 보상이 있는지 검증
    const alreadyRewardedForUser =
      await this.invitationRepository.hasInviteRewardForUser(
        invitation.senderId,
        invitedUserId,
      );
    if (alreadyRewardedForUser) {
      void this.slackService.reportToInvitationNoti(
        `이미 초대 리워드가 지급된 유저입니다.`,
        invitation.senderId,
      );
      return { success: false, error: '이미 처리된 초대입니다.' };
    }

    // === 검증 통과, 보상 처리 시작 ===

    // 8. 초대 관계 생성
    const invitationUserId =
      await this.invitationRepository.createInvitationUser(
        invitation.id,
        invitedUserId,
        signupType ?? 'normal',
        receiptId,
      );

    // 9. 초대자에게 INVITE_REWARD 지급 (파트너 프로그램 기간이면 증액)
    const isReceiptInvite = signupType === 'receipt' && receiptId;
    const senderActiveProgram =
      await this.partnerProgramRepository.findActiveProgram(
        invitation.senderId,
        new Date(),
      );
    const invitePoints = senderActiveProgram
      ? PARTNER_POINTS_PER_INVITATION
      : POINTS_PER_INVITATION;

    await this.pointWriteService.addPoint({
      userId: invitation.senderId,
      amount: invitePoints,
      type: 'INVITE_REWARD',
      additionalData: senderActiveProgram
        ? {
            invited_user_id: invitedUserId,
            partner_program_id: senderActiveProgram.id,
          }
        : { invited_user_id: invitedUserId },
    });

    // 9-1. 영수증 초대 시 추가 보너스 20P (INVITATION_RECEIPT)
    if (isReceiptInvite) {
      await this.pointWriteService.addPoint({
        userId: invitation.senderId,
        amount: RECEIPT_BONUS_POINT,
        type: 'INVITATION_RECEIPT',
        additionalData: {
          invited_user_id: invitedUserId,
          receipt_id: receiptId,
        },
      });
    }

    // 10. 초대자에게 모달 생성 (영수증 초대 시 별도 모달)
    if (isReceiptInvite) {
      await this.userModalRepository.createModal(
        invitation.senderId,
        'invite_receipt_reward_received',
        {
          rewardAmount: POINTS_PER_INVITATION,
          receiptBonusAmount: RECEIPT_BONUS_POINT,
          receiptId,
        },
      );
    } else {
      await this.userModalRepository.createModal(
        invitation.senderId,
        'invite_reward_received',
        { rewardAmount: POINTS_PER_INVITATION },
      );
    }

    // 11. 초대자에게 FCM 리프레시 + 푸시 알림
    const totalReward = isReceiptInvite
      ? POINTS_PER_INVITATION + RECEIPT_BONUS_POINT
      : POINTS_PER_INVITATION;
    void this.fcmService.sendRefreshMessage(
      invitation.senderId,
      'point_update',
    );
    void this.fcmService.pushNotification(
      invitation.senderId,
      `${addSeparator(totalReward)} 포인트 지급 완료 💰`,
      `내가 초대한 친구가 가입했어요!`,
    );

    // 12. 디바이스 이벤트 기록
    await this.invitationRepository.createDeviceEventParticipation(
      resolvedDeviceId,
      'invitation_reward',
      invitedUserId,
    );

    // 13. 피초대자에게 랜덤 포인트 지급
    const rewardPoint = getRandomRewardPoint();
    await this.pointWriteService.addPoint({
      userId: invitedUserId,
      amount: rewardPoint,
      type: 'INVITED_USER_REWARD_RANDOM',
      additionalData: { invitation_user_id: invitationUserId },
    });

    // Slack: 초대 성공 로깅
    void this.slackService.reportToInvitationNoti(
      `✅ 초대를 성공한 유저에게 리워드가 지급되었습니다.`,
      invitation.senderId,
    );

    // Slack: 랜덤 리워드 금액 로깅
    const emoji = rewardPoint > 1000 ? '🎉' : '✅';
    void this.slackService.reportToInvitationNoti(
      `${emoji} 초대를 성공한 유저에게 랜덤 리워드가 지급되었습니다. ${rewardPoint}원`,
      invitedUserId,
    );

    return { success: true, rewardPoint };
  }

  private static readonly RECEIPT_EXPIRY_MINUTES = 12;

  async isReceiptExpired(receiptId: number): Promise<boolean> {
    const receipt =
      await this.invitationRepository.findEveryReceiptById(receiptId);

    if (!receipt) return true;
    if (receipt.status !== 'completed') return true;

    const receiptAge = Date.now() - new Date(receipt.created_at).getTime();
    return receiptAge > InvitationService.RECEIPT_EXPIRY_MINUTES * 60 * 1000;
  }

  async grantReceiptPoint(params: {
    receiptId: number;
    invitedUserId: string;
  }): Promise<{ receiptPoint: number }> {
    const { receiptId, invitedUserId } = params;

    const receipt =
      await this.invitationRepository.findEveryReceiptById(receiptId);

    if (!receipt) {
      throw new NotFoundException('영수증을 찾을 수 없습니다.');
    }

    if (receipt.status !== 'completed') {
      throw new BadRequestException('완료되지 않은 영수증입니다.');
    }

    const receiptAge = Date.now() - new Date(receipt.created_at).getTime();
    if (receiptAge > InvitationService.RECEIPT_EXPIRY_MINUTES * 60 * 1000) {
      throw new BadRequestException('유효 시간이 초과된 영수증입니다.');
    }

    await this.pointWriteService.addPoint({
      userId: invitedUserId,
      amount: receipt.point,
      type: 'INVITATION_RECEIPT',
      additionalData: { source_receipt_id: receiptId, point: receipt.point },
    });

    return { receiptPoint: receipt.point };
  }

  async getReceiptStats(receiptId: number): Promise<{
    friendCount: number;
    inviteBonusPoint: number;
    togetherReceiptBonusPoint: number;
    totalBonusPoint: number;
  }> {
    const friendCount =
      await this.invitationRepository.countInvitedUsersByReceiptId(receiptId);

    const inviteBonusPoint = friendCount * POINTS_PER_INVITATION;
    const togetherReceiptBonusPoint = friendCount * RECEIPT_BONUS_POINT;
    const totalBonusPoint = inviteBonusPoint + togetherReceiptBonusPoint;

    return {
      friendCount,
      inviteBonusPoint,
      togetherReceiptBonusPoint,
      totalBonusPoint,
    };
  }

  async findTopInviters(
    minInviteCount: number,
  ): Promise<{ userId: string; email: string | null; inviteCount: number }[]> {
    return this.invitationRepository.findTopInviters(minInviteCount);
  }

  async getPartnerStepEvent(userId: string): Promise<
    | { isActive: false }
    | {
        isActive: true;
        programId: number;
        startsAt: string;
        endsAt: string;
        invitationCount: number;
        pointsPerInvitation: number;
        receivedRewards: number[];
        pointsEarned: number;
        steps: typeof PARTNER_INVITATION_STEPS;
        totalInvitationCount: number;
        totalInvitationPoints: number;
      }
  > {
    const program = await this.partnerProgramRepository.findActiveProgram(
      userId,
      new Date(),
    );

    if (!program) {
      return { isActive: false };
    }

    const invitationId =
      await this.invitationRepository.findInvitationIdByUserId(userId);

    const [
      invitationCount,
      totalInvitationCount,
      stepRewards,
      totalInvitationPoints,
    ] = await Promise.all([
      invitationId === null
        ? Promise.resolve(0)
        : this.invitationRepository.countInvitedUsersBetween(
            invitationId,
            program.startsAt,
            program.endsAt,
          ),
      invitationId === null
        ? Promise.resolve(0)
        : this.invitationRepository.countTotalInvitedUsers(invitationId),
      this.invitationRepository.findStepRewardsByProgram(userId, program.id),
      this.invitationRepository.sumInviteEarnedPoints(userId),
    ]);

    const receivedRewards = stepRewards.map((r) => r.stepCount);
    const basePoints = invitationCount * PARTNER_POINTS_PER_INVITATION;
    const stepPoints = receivedRewards.reduce((total, stepCount) => {
      const step = PARTNER_INVITATION_STEPS.find((s) => s.count === stepCount);
      return total + (step?.amount ?? 0);
    }, 0);

    return {
      isActive: true,
      programId: program.id,
      startsAt: program.startsAt,
      endsAt: program.endsAt,
      invitationCount,
      pointsPerInvitation: PARTNER_POINTS_PER_INVITATION,
      receivedRewards,
      pointsEarned: basePoints + stepPoints,
      steps: PARTNER_INVITATION_STEPS,
      totalInvitationCount,
      totalInvitationPoints,
    };
  }

  async claimPartnerStepReward(
    userId: string,
    stepCount: number,
  ): Promise<StepRewardResponseDto> {
    const program = await this.partnerProgramRepository.findActiveProgram(
      userId,
      new Date(),
    );

    if (!program) {
      return { success: false, error: 'No active partner program' };
    }

    const invitationId =
      await this.invitationRepository.findInvitationIdByUserId(userId);

    if (invitationId === null) {
      return { success: false, error: 'Invitation not found' };
    }

    const currentCount =
      await this.invitationRepository.countInvitedUsersBetween(
        invitationId,
        program.startsAt,
        program.endsAt,
      );

    if (currentCount < stepCount) {
      throw new BadRequestException('Current count is less than step count');
    }

    const eligibleStep = PARTNER_INVITATION_STEPS.find(
      (s) => s.count === stepCount,
    );

    if (!eligibleStep) {
      throw new BadRequestException('Eligible step not found');
    }

    const alreadyReceived =
      await this.invitationRepository.hasStepRewardByProgram(
        userId,
        stepCount,
        program.id,
      );

    if (alreadyReceived) {
      throw new ConflictException('Already received step reward');
    }

    await this.pointWriteService.addPoint({
      userId,
      amount: eligibleStep.amount,
      type: 'INVITE_STEP_REWARD',
      additionalData: {
        step_count: eligibleStep.count,
        step_name: eligibleStep.reward,
        partner_program_id: program.id,
      },
    });

    return { success: true };
  }

  async getPartnerStatus(
    userId: string,
  ): Promise<
    { isActive: false } | { isActive: true; startsAt: string; endsAt: string }
  > {
    const program = await this.partnerProgramRepository.findActiveProgram(
      userId,
      new Date(),
    );

    if (!program) {
      return { isActive: false };
    }

    return {
      isActive: true,
      startsAt: program.startsAt,
      endsAt: program.endsAt,
    };
  }

  async registerPartners(params: {
    userIds: string[];
    startsAt: string;
    endsAt: string;
  }): Promise<{ createdCount: number }> {
    const { userIds, startsAt, endsAt } = params;

    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const uniqueUserIds = Array.from(new Set(userIds));

    const duplicateUserIds =
      await this.partnerProgramRepository.findOverlappingUserIds(
        uniqueUserIds,
        startsAt,
        endsAt,
      );

    if (duplicateUserIds.length > 0) {
      throw new ConflictException({
        error: '이미 겹치는 기간에 등록된 유저가 있습니다.',
        duplicateUserIds,
      });
    }

    const createdCount = await this.partnerProgramRepository.createMany(
      uniqueUserIds.map((userId) => ({ userId, startsAt, endsAt })),
    );

    return { createdCount };
  }
}
