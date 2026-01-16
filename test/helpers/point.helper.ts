import { SupabaseClient } from '@supabase/supabase-js';

export type PointActionType =
  | 'EVERY_RECEIPT'
  | 'ATTENDANCE'
  | 'EXCHANGE_POINT_TO_CASH'
  | 'REFERRAL'
  | 'EVENT';

export type PointActionStatus = 'done' | 'pending' | 'cancelled';

export interface TestPointAction {
  id?: number;
  user_id: string;
  type: PointActionType;
  point_amount: number;
  status?: PointActionStatus;
  created_at?: string;
  additional_data?: Record<string, unknown>;
}

export interface TestUserPointSnapshot {
  id?: number;
  user_id: string;
  point_balance: number;
  created_at?: string;
}

export interface TestMonthlyEarnedPoint {
  id?: number;
  user_id: string;
  year_month: string; // 'YYYY-MM-01' format (date type in DB)
  earned_points: number;
  created_at?: string;
}

/**
 * 포인트 액션 생성
 */
export async function createPointAction(
  supabase: SupabaseClient,
  data: TestPointAction,
): Promise<TestPointAction> {
  const pointAction = {
    user_id: data.user_id,
    type: data.type,
    point_amount: data.point_amount,
    status: data.status ?? 'done',
    created_at: data.created_at ?? new Date().toISOString(),
    additional_data: data.additional_data ?? {},
  };

  const { data: result, error } = await supabase
    .from('point_actions')
    .insert(pointAction)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create point action: ${error.message}`);
  }

  return result;
}

/**
 * 여러 포인트 액션 생성
 */
export async function createPointActions(
  supabase: SupabaseClient,
  actions: TestPointAction[],
): Promise<TestPointAction[]> {
  const pointActions = actions.map((action) => ({
    user_id: action.user_id,
    type: action.type,
    point_amount: action.point_amount,
    status: action.status ?? 'done',
    created_at: action.created_at ?? new Date().toISOString(),
    additional_data: action.additional_data ?? {},
  }));

  const { data: result, error } = await supabase
    .from('point_actions')
    .insert(pointActions)
    .select();

  if (error) {
    throw new Error(`Failed to create point actions: ${error.message}`);
  }

  return result;
}

/**
 * 유저 포인트 스냅샷 생성
 */
export async function createUserPointSnapshot(
  supabase: SupabaseClient,
  data: TestUserPointSnapshot,
): Promise<TestUserPointSnapshot> {
  const snapshot = {
    user_id: data.user_id,
    point_balance: data.point_balance,
    created_at: data.created_at ?? new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('user_point_snapshots')
    .insert(snapshot)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user point snapshot: ${error.message}`);
  }

  return result;
}

/**
 * 월별 적립 포인트 생성
 */
export async function createMonthlyEarnedPoint(
  supabase: SupabaseClient,
  data: TestMonthlyEarnedPoint,
): Promise<TestMonthlyEarnedPoint> {
  const monthlyPoint = {
    user_id: data.user_id,
    year_month: data.year_month,
    earned_points: data.earned_points,
    created_at: data.created_at ?? new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('monthly_earned_points')
    .insert(monthlyPoint)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create monthly earned point: ${error.message}`);
  }

  return result;
}

/**
 * 과거 날짜 생성 헬퍼 (N개월 전)
 */
export function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
}

/**
 * 년월 문자열 생성 (YYYY-MM-01 형식)
 */
export function getYearMonthDate(monthsAgo: number = 0): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}
