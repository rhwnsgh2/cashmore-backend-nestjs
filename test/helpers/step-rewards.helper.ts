import type { SupabaseClient } from '@supabase/supabase-js';

export async function createStepLevelClaim(
  supabase: SupabaseClient,
  data: {
    user_id: string;
    claim_date: string;
    level: number;
    current_step_count: number;
  },
) {
  const { data: claim, error } = await supabase
    .from('step_level_claims')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create step level claim: ${error.message}`);
  }

  return claim;
}

export async function getStepLevelClaims(
  supabase: SupabaseClient,
  userId: string,
  date: string,
) {
  const { data, error } = await supabase
    .from('step_level_claims')
    .select('*')
    .eq('user_id', userId)
    .eq('claim_date', date);

  if (error) {
    throw new Error(`Failed to get step level claims: ${error.message}`);
  }

  return data;
}
