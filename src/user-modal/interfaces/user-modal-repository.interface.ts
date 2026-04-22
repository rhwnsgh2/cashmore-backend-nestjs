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
  | 'every_receipt_re_reviewed'
  | 'invitation_lotto_result'
  | 'invitation_receipt_received'
  | 'invitation_receipt_onboarding'
  | 'invite_receipt_reward_received'
  | 'exchange_point_to_naverpay'
  | 'partner_selected';

export type UserModalStatus = 'pending' | 'completed';

export interface UserModal {
  id: number;
  name: UserModalType;
  status: UserModalStatus;
  additionalData: Record<string, unknown> | null;
}

export interface IUserModalRepository {
  findPendingByUserId(userId: string): Promise<UserModal[]>;
  hasModalByName(userId: string, name: UserModalType): Promise<boolean>;
  createModal(
    userId: string,
    name: UserModalType,
    additionalData?: Record<string, unknown>,
  ): Promise<void>;
  completeModal(userId: string, modalId: number): Promise<void>;
}

export const USER_MODAL_REPOSITORY = Symbol('USER_MODAL_REPOSITORY');
