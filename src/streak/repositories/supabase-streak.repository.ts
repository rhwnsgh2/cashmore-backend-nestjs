import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IStreakRepository,
  Streak,
} from '../interfaces/streak-repository.interface';

@Injectable()
export class SupabaseStreakRepository implements IStreakRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findStreaks(userId: string): Promise<Streak[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const { data, error } = await (this.supabaseService.getClient() as any).rpc(
      'get_user_streaks',
      { p_user_id: userId },
    );

    if (error) {
      throw error;
    }

    return (data ?? []) as Streak[];
  }
}
