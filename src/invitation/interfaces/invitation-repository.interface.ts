export interface Invitation {
  id: number;
  senderId: string;
  createdAt: string;
  identifier: string;
  type: 'default' | 'normal';
  status: 'pending' | 'used';
}

export interface StepRewardAction {
  stepCount: number;
}

export interface EveryReceipt {
  id: number;
  user_id: string;
  point: number;
  status: string;
  image_url: string;
  score_data: Record<string, unknown> | null;
  created_at: string;
}

export interface IInvitationRepository {
  createOrGetInvitation(
    userId: string,
    type?: 'default' | 'normal',
  ): Promise<Invitation>;
  getInvitationByCode(code: string): Promise<Invitation | null>;
  findInvitationIdByUserId(userId: string): Promise<number | null>;
  countInvitedUsersSince(invitationId: number, since: string): Promise<number>;
  countInvitedUsersBetween(
    invitationId: number,
    startsAt: string,
    endsAt: string,
  ): Promise<number>;
  countTotalInvitedUsers(invitationId: number): Promise<number>;
  findStepRewards(userId: string): Promise<StepRewardAction[]>;
  hasStepReward(userId: string, stepCount: number): Promise<boolean>;
  findStepRewardsByProgram(
    userId: string,
    programId: number,
  ): Promise<StepRewardAction[]>;
  hasStepRewardByProgram(
    userId: string,
    stepCount: number,
    programId: number,
  ): Promise<boolean>;

  // processInvitationReward 관련
  findUserDeviceId(userId: string): Promise<string | null>;
  findUserCreatedAt(userId: string): Promise<string | null>;
  hasDeviceEventParticipation(
    deviceId: string,
    eventName: string,
  ): Promise<boolean>;
  createDeviceEventParticipation(
    deviceId: string,
    eventName: string,
    userId: string,
  ): Promise<void>;
  hasInviteRewardForUser(
    senderId: string,
    invitedUserId: string,
  ): Promise<boolean>;
  createInvitationUser(
    invitationId: number,
    userId: string,
    type?: 'normal' | 'receipt',
    sourceReceiptId?: number,
  ): Promise<number>;

  // 영수증 초대 통계
  countInvitedUsersByReceiptId(receiptId: number): Promise<number>;

  // grantReceiptPoint 관련
  findEveryReceiptById(receiptId: number): Promise<EveryReceipt | null>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
