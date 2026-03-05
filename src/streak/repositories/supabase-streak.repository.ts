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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const params: Record<string, unknown> = { p_user_id: userId };
    if (days !== undefined) {
      params.p_days = days;
    }

    const { data, error } = await (this.supabaseService.getClient() as any).rpc(
      'get_user_streaks',
      params,
    );

    if (error) {
      throw error;
    }

    return (data ?? []) as Streak[];
  }
}
