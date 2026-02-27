import { SupabaseClient } from '@supabase/supabase-js';

export interface TestBuzzvilPostbackBody {
  user_id: string;
  transaction_id: string;
  point: string;
  unit_id: string;
  title: string;
  event_at: string;
  action_type: string;
  revenue_type: string;
  campaign_id: string;
}

export function buildPostbackBody(
  overrides: Partial<TestBuzzvilPostbackBody> = {},
): TestBuzzvilPostbackBody {
  return {
    user_id: 'auth-123',
    transaction_id: `txn-${Date.now()}`,
    point: '100',
    unit_id: '321273326536299',
    title: '테스트 광고',
    event_at: String(Math.floor(Date.now() / 1000)),
    action_type: 'l',
    revenue_type: 'cpc',
    campaign_id: '10075328',
    ...overrides,
  };
}

export async function findBuzzvilReward(
  supabase: SupabaseClient,
  userId: string,
  campaignId: number,
) {
  const { data, error } = await supabase
    .from('point_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'BUZZVIL_REWARD')
    .eq('additional_data->>campaign_id', String(campaignId))
    .limit(1)
    .single();

  if (error) return null;
  return data;
}
