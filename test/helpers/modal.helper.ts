import { SupabaseClient } from '@supabase/supabase-js';

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

export interface TestUserModal {
  id?: number;
  user_id: string;
  name: UserModalType;
  status?: UserModalStatus;
  additional_data?: Record<string, unknown>;
  created_at?: string;
}

/**
 * 유저 모달 생성
 */
export async function createUserModal(
  supabase: SupabaseClient,
  data: TestUserModal,
): Promise<TestUserModal> {
  const modal = {
    user_id: data.user_id,
    name: data.name,
    status: data.status ?? 'pending',
    additional_data: data.additional_data ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('modal_shown')
    .insert(modal)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user modal: ${error.message}`);
  }

  return result;
}

/**
 * 여러 유저 모달 생성
 */
export async function createUserModals(
  supabase: SupabaseClient,
  modals: TestUserModal[],
): Promise<TestUserModal[]> {
  const modalData = modals.map((modal) => ({
    user_id: modal.user_id,
    name: modal.name,
    status: modal.status ?? 'pending',
    additional_data: modal.additional_data ?? null,
    created_at: modal.created_at ?? new Date().toISOString(),
  }));

  const { data: result, error } = await supabase
    .from('modal_shown')
    .insert(modalData)
    .select();

  if (error) {
    throw new Error(`Failed to create user modals: ${error.message}`);
  }

  return result;
}
