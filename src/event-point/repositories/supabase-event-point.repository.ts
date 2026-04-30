import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IEventPointRepository,
  EventPoint,
} from '../interfaces/event-point-repository.interface';

interface CoupangVisitRow {
  id: number;
  created_at: string;
  point_amount: number;
}

/**
 * @deprecated 쿠팡 오늘 방문 여부 확인용으로 축소됨. 최근 24시간 내 coupang_visits 행만 반환한다.
 * 신규 클라이언트는 GET /coupang/visit/today를 사용한다.
 */
@Injectable()
export class SupabaseEventPointRepository implements IEventPointRepository {
  constructor(private supabase: SupabaseService) {}

  async findByUserId(userId: string): Promise<EventPoint[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .getClient()
      .from('coupang_visits')
      .select('id, created_at, point_amount')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .returns<CoupangVisitRow[]>();

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      id: row.id,
      type: 'COUPANG_VISIT',
      createdAt: row.created_at,
      point: row.point_amount,
    }));
  }
}
