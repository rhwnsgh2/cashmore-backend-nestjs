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
}

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
