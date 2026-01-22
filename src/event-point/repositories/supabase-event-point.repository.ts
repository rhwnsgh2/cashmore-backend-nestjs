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

@Injectable()
export class SupabaseEventPointRepository implements IEventPointRepository {
  constructor(private supabase: SupabaseService) {}

  async findByUserId(userId: string): Promise<EventPoint[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('point_actions')
      .select('id, created_at, point_amount, type')
      .eq('user_id', userId)
      .in('type', ['COUPANG_VISIT', 'ONBOARDING_EVENT', 'AFFILIATE', 'LOTTERY'])
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
