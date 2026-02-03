import { SupabaseClient } from '@supabase/supabase-js';

export interface TestDeviceEventParticipation {
  device_id: string;
  event_name: string;
}

export interface TestInvitationUser {
  user_id: string;
}

export async function createDeviceEventParticipation(
  supabase: SupabaseClient,
  data: TestDeviceEventParticipation,
): Promise<void> {
  const { error } = await supabase
    .from('device_event_participation')
    .insert(data);

  if (error) {
    throw new Error(
      `Failed to create device event participation: ${error.message}`,
    );
  }
}

export async function createInvitationUser(
  supabase: SupabaseClient,
  data: TestInvitationUser,
): Promise<void> {
  const { error } = await supabase.from('invitation_user').insert(data);

  if (error) {
    throw new Error(`Failed to create invitation user: ${error.message}`);
  }
}

export async function updateUserDeviceId(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<void> {
  const { error } = await supabase
    .from('user')
    .update({ device_id: deviceId })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update user device_id: ${error.message}`);
  }
}
