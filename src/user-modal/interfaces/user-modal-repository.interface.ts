export type UserModalType =
  | 'onboarding'
  | 'interview'
  | 'nps_survey'
  | 'drop_cashback_received'
  | 'claim_cashback_received'
  | 'invite_code_input'
  | 'invite_code_input_lotto'
  | 'exchange_point_to_cash'
  | 'invite_reward_received'
  | 'invited_user_reward_received'
  | 'invited_user_mission_reward'
  | 'affiliate_prepayment_received'
  | 'every_receipt_re_reviewed';

export type UserModalStatus = 'pending' | 'completed';

export interface UserModal {
  id: number;
  name: UserModalType;
  status: UserModalStatus;
  additionalData: Record<string, unknown> | null;
}

export interface IUserModalRepository {
  findPendingByUserId(userId: string): Promise<UserModal[]>;
}

export const USER_MODAL_REPOSITORY = Symbol('USER_MODAL_REPOSITORY');
