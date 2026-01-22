import { SupabaseClient } from '@supabase/supabase-js';

export type ReceiptStatus = 'completed' | 'pending' | 'rejected';

export interface TestReceiptSubmission {
  id?: string;
  user_id: string;
  created_at?: string;
  status?: ReceiptStatus;
  point?: number | null;
  image_url?: string | null;
}

/**
 * 영수증 제출 생성
 */
export async function createReceiptSubmission(
  supabase: SupabaseClient,
  data: TestReceiptSubmission,
): Promise<TestReceiptSubmission> {
  const submission = {
    user_id: data.user_id,
    created_at: data.created_at ?? new Date().toISOString(),
    status: data.status ?? 'completed',
    point: data.point ?? 0,
    image_url: data.image_url ?? '',
  };

  const { data: result, error } = await supabase
    .from('every_receipt')
    .insert(submission)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create receipt submission: ${error.message}`);
  }

  return result;
}

/**
 * 여러 영수증 제출 생성 (배치 처리)
 */
export async function createReceiptSubmissions(
  supabase: SupabaseClient,
  submissions: TestReceiptSubmission[],
): Promise<void> {
  const BATCH_SIZE = 500;
  const data = submissions.map((s) => ({
    user_id: s.user_id,
    created_at: s.created_at ?? new Date().toISOString(),
    status: s.status ?? 'completed',
    point: s.point ?? 0,
    image_url: s.image_url ?? '',
  }));

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('every_receipt').insert(batch);

    if (error) {
      throw new Error(`Failed to create receipt submissions: ${error.message}`);
    }
  }
}
