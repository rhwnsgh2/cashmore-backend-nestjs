import { SupabaseClient } from '@supabase/supabase-js';

export type ReceiptStatus = 'completed' | 'pending' | 'rejected';

export interface TestReceiptSubmission {
  id?: string;
  user_id: string;
  created_at?: string;
  status?: ReceiptStatus;
  point?: number | null;
  image_url?: string | null;
  score_data?: Record<string, unknown> | null;
}

/**
 * 영수증 제출 생성
 */
export async function createReceiptSubmission(
  supabase: SupabaseClient,
  data: TestReceiptSubmission,
): Promise<TestReceiptSubmission> {
  const submission: Record<string, unknown> = {
    user_id: data.user_id,
    created_at: data.created_at ?? new Date().toISOString(),
    status: data.status ?? 'completed',
    point: data.point ?? 0,
    image_url: data.image_url ?? '',
  };

  if (data.score_data !== undefined) {
    submission.score_data = data.score_data;
  }

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
  const data = submissions.map((s) => {
    const row: Record<string, unknown> = {
      user_id: s.user_id,
      created_at: s.created_at ?? new Date().toISOString(),
      status: s.status ?? 'completed',
      point: s.point ?? 0,
      image_url: s.image_url ?? '',
    };
    if (s.score_data !== undefined) {
      row.score_data = s.score_data;
    }
    return row;
  });

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('every_receipt').insert(batch);

    if (error) {
      throw new Error(`Failed to create receipt submissions: ${error.message}`);
    }
  }
}

/**
 * 영수증 재검수 레코드 생성
 */
export async function createReceiptReReview(
  supabase: SupabaseClient,
  data: {
    every_receipt_id: number;
    status: 'pending' | 'completed' | 'rejected';
  },
): Promise<void> {
  const { error } = await supabase.from('every_receipt_re_review').insert({
    every_receipt_id: data.every_receipt_id,
    status: data.status,
  });

  if (error) {
    throw new Error(`Failed to create re-review record: ${error.message}`);
  }
}
