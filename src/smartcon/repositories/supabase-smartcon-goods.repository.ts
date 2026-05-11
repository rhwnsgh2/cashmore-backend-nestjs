import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { Json } from '../../supabase/database.types';
import type {
  ISmartconGoodsRepository,
  SmartconGoodsRow,
  SmartconGoodsUpsertInput,
  SyncByEventResult,
  UncachedGoods,
} from '../interfaces/smartcon-goods-repository.interface';

@Injectable()
export class SupabaseSmartconGoodsRepository implements ISmartconGoodsRepository {
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
      .map((r) => r.goods_id)
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

  async findUncachedByEvent(eventId: string): Promise<UncachedGoods[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('smartcon_goods')
      .select('goods_id, img_url_https')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .is('cached_img_url', null)
      .not('img_url_https', 'is', null);
    if (error) throw error;
    return (data ?? [])
      .filter(
        (r): r is { goods_id: string; img_url_https: string } =>
          typeof r.img_url_https === 'string',
      )
      .map((r) => ({ goods_id: r.goods_id, img_url_https: r.img_url_https }));
  }

  async updateCachedImage(
    goodsId: string,
    cachedImgUrl: string,
    cachedImgAt: string,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('smartcon_goods')
      .update({
        cached_img_url: cachedImgUrl,
        cached_img_at: cachedImgAt,
        updated_at: cachedImgAt,
      })
      .eq('goods_id', goodsId);
    if (error) throw error;
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

  async findGoodsIdsByBrand(brand: string): Promise<string[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('smartcon_goods')
      .select('goods_id')
      .eq('brand_name', brand)
      .eq('is_active', true);
    if (error) throw error;
    return (data ?? []).map((r: { goods_id: string }) => r.goods_id);
  }
}
