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

export interface IInvitationRepository {
  createOrGetInvitation(
    userId: string,
    type?: 'default' | 'normal',
  ): Promise<Invitation>;
  getInvitationByCode(code: string): Promise<Invitation | null>;
  findInvitationIdByUserId(userId: string): Promise<number | null>;
  countInvitedUsersSince(invitationId: number, since: string): Promise<number>;
  findStepRewards(userId: string): Promise<StepRewardAction[]>;
  hasStepReward(userId: string, stepCount: number): Promise<boolean>;
  createStepReward(
    userId: string,
    amount: number,
    stepCount: number,
    stepName: string,
  ): Promise<void>;

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
  createInvitationUser(invitationId: number, userId: string): Promise<number>;
  createPointAction(
    userId: string,
    type: string,
    pointAmount: number,
    additionalData: Record<string, unknown>,
  ): Promise<void>;
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
