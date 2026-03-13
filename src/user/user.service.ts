import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  IUserRepository,
  UserRole,
  UserProvider,
} from './interfaces/user-repository.interface';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';
import type { IUserModalRepository } from '../user-modal/interfaces/user-modal-repository.interface';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { InvitationService } from '../invitation/invitation.service';
import { SignupType } from './dto/create-user.dto';

export interface UserInfoResponse {
  id: string;
  email: string;
  role: UserRole;
  provider: UserProvider;
  createdAt: string;
  isBanned: boolean;
  banReason: string | null;
  marketingAgreement: boolean;
  nickname: string;
}

export interface CreateUserParams {
  authId: string;
  email: string;
  fcmToken?: string;
  marketingAgreement: boolean;
  onboardingCompleted: boolean;
  deviceId?: string;
  signupContext?: {
    type: SignupType;
    invitationCode: string;
    receiptId?: number;
  };
}

export interface InvitationRewardResult {
  type: SignupType;
  success: boolean;
  rewardPoint?: number;
  error?: string;
  receiptPoint?: number;
}

export interface CreateUserResult {
  success: boolean;
  userId?: string;
  nickname?: string;
  error?: string;
  invitationReward?: InvitationRewardResult;
}

const ONBOARDING_POINT_AMOUNT = 40;

const ADJECTIVES = [
  '따뜻한',
  '다정한',
  '부드러운',
  '행복한',
  '상냥한',
  '여유로운',
  '평화로운',
  '밝은',
  '활기찬',
  '느긋한',
  '씩씩한',
  '편안한',
  '귀여운',
  '유쾌한',
  '포근한',
  '진심인',
  '성실한',
  '소중한',
  '깔끔한',
  '똑똑한',
  '온화한',
  '명랑한',
  '사랑스러운',
  '낙천적인',
  '담백한',
  '진정한',
  '든든한',
  '친절한',
  '꾸준한',
  '다부진',
  '부지런한',
  '따사로운',
  '상쾌한',
  '단단한',
  '유연한',
  '재치있는',
  '열정적인',
  '집중하는',
  '소박한',
  '묵직한',
  '사려깊은',
  '확실한',
  '정직한',
  '용감한',
  '기분좋은',
  '정다운',
  '잔잔한',
  '햇살같은',
  '단정한',
  '기운찬',
  '깨끗한',
  '자연스러운',
  '상큼한',
  '감성적인',
  '신중한',
  '섬세한',
  '활발한',
  '정갈한',
  '꼼꼼한',
  '진솔한',
  '확고한',
  '자상한',
  '선한',
  '믿음직한',
  '침착한',
  '쿨한',
  '평온한',
  '청량한',
  '알뜰한',
  '푸른',
  '맑은',
  '조용한',
  '화사한',
  '푸근한',
  '반짝이는',
  '싱그러운',
  '다채로운',
  '순한',
  '고요한',
  '풋풋한',
  '똘똘한',
] as const;

const NOUNS = [
  '고양이',
  '강아지',
  '사자',
  '코끼리',
  '호랑이',
  '여우',
  '토끼',
  '다람쥐',
  '펭귄',
  '돌고래',
  '고래',
  '참새',
  '비둘기',
  '까치',
  '부엉이',
  '독수리',
  '고슴도치',
  '거북이',
  '병아리',
  '백로',
  '오리',
  '송아지',
  '판다',
  '캥거루',
  '코알라',
  '나비',
  '너구리',
  '무당벌레',
  '물고기',
  '금붕어',
  '햄스터',
  '장미',
  '해바라기',
  '튤립',
  '코스모스',
  '수국',
  '백합',
  '국화',
  '민들레',
  '클로버',
  '라벤더',
  '선인장',
  '소나무',
  '참나무',
  '단풍',
  '벚꽃',
  '목련',
  '대나무',
  '풀잎',
  '연꽃',
  '들꽃',
  '수련',
  '포도',
  '사과',
  '복숭아',
  '꿀벌',
  '딸기',
  '바나나',
  '수박',
  '멜론',
  '오렌지',
  '블루베리',
  '체리',
  '레몬',
  '쿼카',
  '카피바라',
  '호두',
  '나뭇잎',
  '개나리',
  '꽃잎',
  '열매',
  '새싹',
  '버섯',
  '구름',
  '매화',
  '진달래',
  '철쭉',
  '모란',
] as const;

function generateNickname(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${adjective}${noun}${suffix}`;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private userRepository: IUserRepository,
    @Inject(USER_MODAL_REPOSITORY)
    private userModalRepository: IUserModalRepository,
    private invitationService: InvitationService,
  ) {}

  async getUserInfo(userId: string): Promise<UserInfoResponse | null> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return null;
    }

    // 닉네임이 없으면 자동 생성 후 업데이트
    let nickname = user.nickname;
    if (!nickname) {
      nickname = generateNickname();
      await this.userRepository.updateNickname(userId, nickname);
    }

    // 차단 여부 확인
    let isBanned = false;
    let banReason: string | null = null;

    if (user.is_banned) {
      banReason = await this.userRepository.findBanReason(user.auth_id);
      isBanned = banReason !== null;
    }

    return {
      id: user.id,
      email: user.email ?? '',
      role: 'user',
      provider: user.provider,
      createdAt: user.created_at,
      isBanned,
      banReason,
      marketingAgreement: user.marketing_info,
      nickname,
    };
  }

  async createUser(params: CreateUserParams): Promise<CreateUserResult> {
    // 1. 이미 존재하는 사용자인지 확인
    const existingUser = await this.userRepository.findByAuthId(params.authId);
    if (existingUser) {
      throw new ConflictException('이미 가입된 사용자입니다.');
    }

    // 2. 닉네임 생성
    const nickname = generateNickname();

    // 3. provider 조회
    const provider = await this.userRepository.getAuthProvider(params.authId);

    // 4. 사용자 생성
    const { id: userId } = await this.userRepository.create({
      authId: params.authId,
      email: params.email,
      nickname,
      fcmToken: params.fcmToken || null,
      marketingAgreement: params.marketingAgreement,
      deviceId: params.deviceId || null,
      provider,
    });

    // 5. 디바이스 등록
    if (params.deviceId) {
      await this.registerDevice(params.deviceId, userId);
    }

    // 6. 온보딩 처리
    if (params.deviceId && params.onboardingCompleted) {
      await this.processOnboarding(params.deviceId, userId);
    }

    // 7. signupContext에 따른 분기 처리
    let invitationReward: InvitationRewardResult | undefined;
    if (params.signupContext) {
      invitationReward = await this.handleSignupContext(
        params.signupContext,
        userId,
        params.deviceId,
      );
    } else {
      await this.handleInviteRewardModal(userId);
    }

    return { success: true, userId, nickname, invitationReward };
  }

  private async registerDevice(
    deviceId: string,
    userId: string,
  ): Promise<void> {
    try {
      const deviceEvents =
        await this.userRepository.findDeviceEventsByDeviceId(deviceId);

      if (deviceEvents.length === 0) {
        await this.userRepository.createDeviceEvent(deviceId, 'joined', userId);
        this.logger.log(
          `[SIGNUP] 디바이스 등록 완료 userId=${userId} deviceId=${deviceId}`,
        );
      } else {
        this.logger.log(
          `[SIGNUP] 기존 디바이스 감지 - 스킵 userId=${userId} deviceId=${deviceId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[SIGNUP] 디바이스 등록 실패 userId=${userId} error=${error}`,
      );
    }
  }

  private async processOnboarding(
    deviceId: string,
    userId: string,
  ): Promise<{ success: boolean; pointAmount?: number; error?: string }> {
    const deviceEvents =
      await this.userRepository.findDeviceEventsByDeviceId(deviceId);
    const alreadyParticipated = deviceEvents.some(
      (e) => e.event_name === 'onboarding_event',
    );

    if (alreadyParticipated) {
      this.logger.log(`[ONBOARDING] 이미 온보딩 완료 - 스킵 userId=${userId}`);
      return { success: false, error: '이미 온보딩을 완료했습니다.' };
    }

    await this.userModalRepository.createModal(userId, 'onboarding');
    await this.userRepository.createDeviceEvent(
      deviceId,
      'onboarding_event',
      userId,
    );
    await this.userRepository.createPointAction(
      userId,
      'ONBOARDING_EVENT',
      ONBOARDING_POINT_AMOUNT,
      {},
    );
    this.logger.log(
      `[ONBOARDING] 온보딩 완료 userId=${userId} point=${ONBOARDING_POINT_AMOUNT}`,
    );
    return { success: true, pointAmount: ONBOARDING_POINT_AMOUNT };
  }

  private async handleSignupContext(
    signupContext: {
      type: SignupType;
      invitationCode: string;
      receiptId?: number;
    },
    userId: string,
    deviceId?: string,
  ): Promise<InvitationRewardResult> {
    this.logger.log(
      `[SIGNUP] userId=${userId} type=${signupContext.type} invitationCode=${signupContext.invitationCode} receiptId=${signupContext.receiptId ?? 'none'} deviceId=${deviceId ?? 'none'}`,
    );
    if (signupContext.type === SignupType.INVITATION_NORMAL) {
      return this.handleInvitationNormal(signupContext, userId, deviceId);
    }
    if (signupContext.type === SignupType.INVITATION_RECEIPT) {
      return this.handleInvitationReceipt(signupContext, userId, deviceId);
    }
    return { type: signupContext.type, success: true };
  }

  private async handleInvitationNormal(
    signupContext: { invitationCode: string },
    userId: string,
    deviceId?: string,
  ): Promise<InvitationRewardResult> {
    try {
      const result = await this.invitationService.processInvitationReward({
        invitedUserId: userId,
        inviteCode: signupContext.invitationCode,
        deviceId,
      });
      this.logger.log(
        `[SIGNUP] invitation_normal 보상처리 완료 userId=${userId} success=${result.success} rewardPoint=${result.rewardPoint}`,
      );
      if (result.success && result.rewardPoint) {
        await this.userModalRepository.createModal(
          userId,
          'invitation_lotto_result',
          { rewardPoint: result.rewardPoint },
        );
      }
      return {
        type: SignupType.INVITATION_NORMAL,
        success: result.success,
        rewardPoint: result.rewardPoint,
        error: result.error,
      };
    } catch (error) {
      this.logger.error(
        `[SIGNUP] invitation_normal 실패 userId=${userId} error=${error}`,
      );
      return {
        type: SignupType.INVITATION_NORMAL,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleInvitationReceipt(
    signupContext: { invitationCode: string; receiptId?: number },
    userId: string,
    deviceId?: string,
  ): Promise<InvitationRewardResult> {
    // 1. 초대 보상 처리
    let inviteSuccess = false;
    let rewardPoint: number | undefined;
    let inviteError: string | undefined;

    try {
      const result = await this.invitationService.processInvitationReward({
        invitedUserId: userId,
        inviteCode: signupContext.invitationCode,
        deviceId,
        signupType: 'receipt',
        receiptId: signupContext.receiptId,
      });
      inviteSuccess = result.success;
      rewardPoint = result.rewardPoint;
      inviteError = result.error;
      this.logger.log(
        `[SIGNUP] invitation_receipt 초대보상 완료 userId=${userId} success=${result.success} rewardPoint=${result.rewardPoint}`,
      );

      if (result.success && result.rewardPoint) {
        await this.userModalRepository.createModal(
          userId,
          'invitation_lotto_result',
          { rewardPoint: result.rewardPoint, hasReceiptReward: true },
        );
      }
    } catch (error) {
      this.logger.error(
        `[SIGNUP] invitation_receipt 초대보상 실패 userId=${userId} error=${error}`,
      );
      inviteError = error instanceof Error ? error.message : 'Unknown error';
    }

    // 2. 영수증 포인트 지급 (초대 보상 성공 시에만)
    let receiptPoint: number | undefined;

    if (signupContext.receiptId && !inviteSuccess) {
      this.logger.log(
        `[SIGNUP] invitation_receipt 초대보상 실패로 영수증 포인트 미지급 userId=${userId} receiptId=${signupContext.receiptId}`,
      );
    }

    if (signupContext.receiptId && inviteSuccess) {
      try {
        const receiptResult = await this.invitationService.grantReceiptPoint({
          receiptId: signupContext.receiptId,
          invitedUserId: userId,
        });
        receiptPoint = receiptResult.receiptPoint;
        await this.userModalRepository.createModal(
          userId,
          'invitation_receipt_received',
          { pointAmount: receiptPoint },
        );
        await this.userModalRepository.createModal(
          userId,
          'invitation_receipt_onboarding',
        );
        this.logger.log(
          `[SIGNUP] invitation_receipt 포인트지급 완료 userId=${userId} receiptId=${signupContext.receiptId} receiptPoint=${receiptPoint}`,
        );
      } catch (error) {
        this.logger.error(
          `[SIGNUP] invitation_receipt 포인트지급 실패 userId=${userId} receiptId=${signupContext.receiptId} error=${error}`,
        );
      }
    }

    this.logger.log(
      `[SIGNUP] invitation_receipt 완료 userId=${userId} inviteSuccess=${inviteSuccess} rewardPoint=${rewardPoint} receiptPoint=${receiptPoint}`,
    );
    return {
      type: SignupType.INVITATION_RECEIPT,
      success: inviteSuccess,
      rewardPoint,
      error: inviteError,
      receiptPoint,
    };
  }

  async completeOnboarding(
    userId: string,
  ): Promise<{ success: boolean; pointAmount?: number; error?: string }> {
    const deviceId = await this.userRepository.findDeviceId(userId);
    if (!deviceId) {
      this.logger.log(`[ONBOARDING] 디바이스 없음 userId=${userId}`);
      return { success: false, error: '디바이스 정보를 찾을 수 없습니다.' };
    }

    return this.processOnboarding(deviceId, userId);
  }

  private async handleInviteRewardModal(userId: string): Promise<void> {
    try {
      const isInvited = await this.userRepository.isInvitedUser(userId);
      if (!isInvited) {
        await this.userModalRepository.createModal(
          userId,
          'invite_code_input_lotto',
        );
      }
    } catch (error) {
      this.logger.error(`Failed to handle invite reward modal: ${error}`);
    }
  }
}
