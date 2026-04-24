import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { Json } from '../../supabase/database.types';
import type {
  ICoupangPostbackRepository,
  CoupangPostbackRecord,
} from '../interfaces/coupang-postback-repository.interface';

@Injectable()
export class SupabaseCoupangPostbackRepository implements ICoupangPostbackRepository {
  constructor(private supabase: SupabaseService) {}

  async save(
    data: Omit<CoupangPostbackRecord, 'id' | 'createdAt'>,
  ): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('coupang_postbacks')
      .insert({
        afcode: data.afcode,
        subid: data.subid,
        os: data.os,
        adid: data.adid,
        click_id: data.clickId,
        order_time: data.orderTime,
        order_price: data.orderPrice,
        purchase_cancel: data.purchaseCancel,
        raw_data: (data.rawData ?? null) as Json | null,
      });

    if (error) {
      throw error;
    }
  }
}
