import { SupabaseClient } from '@supabase/supabase-js';

export async function createDeviceEventParticipation(
  supabase: SupabaseClient,
  data: {
    user_id: string;
    event_name: string;
    device_id?: string;
    created_at?: string;
  },
) {
  const { data: result, error } = await supabase
    .from('device_event_participation')
    .insert({ device_id: 'test-device-id', ...data } as any)
    .select('id, user_id, event_name, created_at')
    .single();

  if (error) {
    throw error;
  }

  return result;
}
