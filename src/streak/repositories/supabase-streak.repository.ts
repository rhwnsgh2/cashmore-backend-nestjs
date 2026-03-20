import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IStreakRepository,
  Streak,
} from '../interfaces/streak-repository.interface';

@Injectable()
export class SupabaseStreakRepository implements IStreakRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findStreaks(userId: string, days?: number): Promise<Streak[]> {
    const params: { p_user_id: string; p_days?: number } = {
      p_user_id: userId,
    };
    if (days !== undefined) {
      params.p_days = days;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_user_streaks', params);

    if (error) {
      throw error;
    }

    return (data ?? []) as Streak[];
  }
}
