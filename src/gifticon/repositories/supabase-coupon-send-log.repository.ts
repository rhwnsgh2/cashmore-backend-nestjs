import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ICouponSendLogRepository,
  CouponSendLogRow,
} from '../interfaces/coupon-send-log-repository.interface';

@Injectable()
export class SupabaseCouponSendLogRepository
  implements ICouponSendLogRepository
{
  constructor(private supabaseService: SupabaseService) {}

  async insert(
    exchangeId: number,
    receiverPhone: string,
  ): Promise<CouponSendLogRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_send_logs')
      .insert({ exchange_id: exchangeId, receiver_phone: receiverPhone })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as CouponSendLogRow;
  }

  async findByExchangeId(exchangeId: number): Promise<CouponSendLogRow[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('coupon_send_logs')
      .select('*')
      .eq('exchange_id', exchangeId)
      .order('sent_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as CouponSendLogRow[];
  }
}
