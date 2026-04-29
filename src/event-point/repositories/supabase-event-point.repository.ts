import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IEventPointRepository,
  EventPoint,
  EventPointType,
} from '../interfaces/event-point-repository.interface';

interface EventPointRow {
  id: number;
  created_at: string;
  point_amount: number;
  type: string;
}

/**
 * @deprecated 쿠팡 오늘 방문 여부 확인용으로 축소됨. 최근 24시간 내 COUPANG_VISIT 액션만 반환한다.
 * 신규 전용 엔드포인트로 대체 예정.
 */
@Injectable()
export class SupabaseEventPointRepository implements IEventPointRepository {
  constructor(private supabase: SupabaseService) {}

  async findByUserId(userId: string): Promise<EventPoint[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .getClient()
      .from('point_actions')
      .select('id, created_at, point_amount, type')
      .eq('user_id', userId)
      .eq('type', 'COUPANG_VISIT')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .returns<EventPointRow[]>();

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      id: row.id,
      type: row.type as EventPointType,
      createdAt: row.created_at,
      point: row.point_amount,
    }));
  }
}
