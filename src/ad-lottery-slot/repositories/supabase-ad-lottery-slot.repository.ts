import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IAdLotterySlotRepository,
  SlotTime,
} from '../interfaces/ad-lottery-slot-repository.interface';

@Injectable()
export class SupabaseAdLotterySlotRepository
  implements IAdLotterySlotRepository
{
  constructor(private supabaseService: SupabaseService) {}

  async hasWatchedInSlot(
    userId: string,
    slotTime: SlotTime,
    startTime: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('ad_lottery_slots')
      .select('id')
      .eq('user_id', userId)
      .eq('slot_time', slotTime)
      .gte('created_at', startTime)
      .limit(1);

    if (error) {
      throw error;
    }

    return data !== null && data.length > 0;
  }
}
