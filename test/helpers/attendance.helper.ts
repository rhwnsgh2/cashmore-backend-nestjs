import { SupabaseClient } from '@supabase/supabase-js';

export interface TestAttendance {
  id?: number;
  user_id: string;
  created_at_date: string; // YYYY-MM-DD
  created_at?: string;
}

/**
 * 출석 기록 생성
 */
export async function createAttendance(
  supabase: SupabaseClient,
  data: TestAttendance,
): Promise<TestAttendance & { id: number }> {
  const attendance = {
    user_id: data.user_id,
    created_at_date: data.created_at_date,
    created_at: data.created_at ?? new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('attendance')
    .insert(attendance)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create attendance: ${error.message}`);
  }

  return result;
}

/**
 * 여러 출석 기록 생성
 */
export async function createAttendances(
  supabase: SupabaseClient,
  attendances: TestAttendance[],
): Promise<Array<TestAttendance & { id: number }>> {
  const records = attendances.map((attendance) => ({
    user_id: attendance.user_id,
    created_at_date: attendance.created_at_date,
    created_at: attendance.created_at ?? new Date().toISOString(),
  }));

  const { data: result, error } = await supabase
    .from('attendance')
    .insert(records)
    .select();

  if (error) {
    throw new Error(`Failed to create attendances: ${error.message}`);
  }

  return result;
}
