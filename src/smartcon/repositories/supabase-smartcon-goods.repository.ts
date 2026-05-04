import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { Json } from '../../supabase/database.types';
import type {
  ISmartconGoodsRepository,
  SmartconGoodsRow,
  SmartconGoodsUpsertInput,
  SyncByEventResult,
} from '../interfaces/smartcon-goods-repository.interface';

@Injectable()
export class SupabaseSmartconGoodsRepository
  implements ISmartconGoodsRepository
{
  private readonly logger = new Logger(SupabaseSmartconGoodsRepository.name);

  constructor(private supabaseService: SupabaseService) {}

  async syncByEvent({
    eventId,
    items,
  }: {
    eventId: string;
    items: SmartconGoodsUpsertInput[];
  }): Promise<SyncByEventResult> {
    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();

    let upserted = 0;
    if (items.length > 0) {
      const rows = items.map(({ raw_data, ...rest }) => ({
        ...rest,
        raw_data: raw_data as unknown as Json,
        is_active: true,
        updated_at: now,
      }));
      const { error } = await client
        .from('smartcon_goods')
        .upsert(rows, { onConflict: 'goods_id' });
      if (error) throw error;
      upserted = rows.length;
    }

    const presentIds = new Set(items.map((it) => it.goods_id));
    const { data: existing, error: fetchError } = await client
      .from('smartcon_goods')
      .select('goods_id')
      .eq('event_id', eventId)
      .eq('is_active', true);
    if (fetchError) throw fetchError;

    const toDeactivate = (existing ?? [])
      .map((r) => r.goods_id as string)
      .filter((id) => !presentIds.has(id));

    if (toDeactivate.length > 0) {
      const { error } = await client
        .from('smartcon_goods')
        .update({ is_active: false, updated_at: now })
        .in('goods_id', toDeactivate);
      if (error) throw error;
    }

    this.logger.log(
      `syncByEvent eventId=${eventId} upserted=${upserted} deactivated=${toDeactivate.length}`,
    );
    return { upserted, deactivated: toDeactivate.length };
  }

  async findAllByEvent(eventId: string): Promise<SmartconGoodsRow[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('smartcon_goods')
      .select('*')
      .eq('event_id', eventId);
    if (error) throw error;
    return (data ?? []) as unknown as SmartconGoodsRow[];
  }

  async findById(goodsId: string): Promise<SmartconGoodsRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('smartcon_goods')
      .select('*')
      .eq('goods_id', goodsId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as SmartconGoodsRow | null;
  }
}
