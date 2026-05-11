import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IGifticonProductRepository,
  CatalogItem,
  VisibleProduct,
  GifticonProductRow,
  UpsertCurationInput,
} from '../interfaces/gifticon-product-repository.interface';

@Injectable()
export class SupabaseGifticonProductRepository implements IGifticonProductRepository {
  private readonly logger = new Logger(SupabaseGifticonProductRepository.name);

  constructor(private supabaseService: SupabaseService) {}

  async listCatalog(eventId: string): Promise<CatalogItem[]> {
    // PostgREST embedded select로 한 번에 JOIN.
    // 이전엔 smartcon_goods + .in(goodsIds) 두 번 호출이라 carousel 100개+ 시
    // URL이 길어져 undici HeadersOverflowError 발생.
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('smartcon_goods')
      .select(
        `
        goods_id,
        brand_name,
        goods_name,
        msg,
        price,
        disc_price,
        img_url_https,
        cached_img_url,
        is_active,
        gifticon_products ( id, point_price, is_visible, display_name, display_order )
      `,
      )
      .eq('event_id', eventId);
    if (error) throw error;

    type EmbeddedProduct = {
      id: number;
      point_price: number;
      is_visible: boolean;
      display_name: string | null;
      display_order: number | null;
    };
    type Row = {
      goods_id: string;
      brand_name: string | null;
      goods_name: string | null;
      msg: string | null;
      price: number | null;
      disc_price: number | null;
      img_url_https: string | null;
      cached_img_url: string | null;
      is_active: boolean;
      gifticon_products: EmbeddedProduct[] | EmbeddedProduct | null;
    };

    return ((data as unknown as Row[] | null) ?? []).map((g) => {
      const products = g.gifticon_products;
      const p = Array.isArray(products) ? (products[0] ?? null) : products;
      return {
        id: p?.id ?? null,
        goods_id: g.goods_id,
        brand_name: g.brand_name ?? null,
        goods_name: g.goods_name ?? null,
        display_name: p?.display_name ?? null,
        display_order: p?.display_order ?? null,
        msg: g.msg ?? null,
        smartcon_price: g.price ?? null,
        smartcon_disc_price: g.disc_price ?? null,
        img_url: g.cached_img_url ?? g.img_url_https ?? null,
        point_price: p?.point_price ?? null,
        is_visible: p?.is_visible ?? false,
        is_active: g.is_active,
      };
    });
  }

  async listVisible(eventId: string): Promise<VisibleProduct[]> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('gifticon_products')
      .select(
        `
        id,
        point_price,
        display_name,
        smartcon_goods!inner (
          goods_id,
          event_id,
          brand_name,
          goods_name,
          msg,
          price,
          img_url_https,
          cached_img_url,
          is_active
        )
      `,
      )
      .eq('is_visible', true)
      .eq('smartcon_goods.event_id', eventId)
      .eq('smartcon_goods.is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row) => {
      const r = row as unknown as {
        id: number;
        point_price: number;
        display_name: string | null;
        smartcon_goods: {
          goods_id: string;
          brand_name: string | null;
          goods_name: string | null;
          msg: string | null;
          price: number | null;
          img_url_https: string | null;
          cached_img_url: string | null;
        };
      };
      const g = r.smartcon_goods;
      return {
        id: r.id,
        goods_id: g.goods_id,
        brand_name: g.brand_name,
        goods_name: r.display_name ?? g.goods_name, // override 우선
        msg: g.msg,
        img_url: g.cached_img_url ?? g.img_url_https ?? null,
        point_price: r.point_price,
        original_price: g.price ?? null,
      };
    });
  }

  async upsertCuration(
    input: UpsertCurationInput,
  ): Promise<GifticonProductRow> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabaseService
      .getClient()
      .from('gifticon_products')
      .upsert(
        {
          smartcon_goods_id: input.smartcon_goods_id,
          point_price: input.point_price,
          is_visible: input.is_visible,
          display_name: input.display_name ?? null,
          updated_at: now,
        },
        { onConflict: 'smartcon_goods_id' },
      )
      .select()
      .single();
    if (error) throw error;
    return data as unknown as GifticonProductRow;
  }

  async findByGoodsId(goodsId: string): Promise<GifticonProductRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('gifticon_products')
      .select('*')
      .eq('smartcon_goods_id', goodsId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as GifticonProductRow | null;
  }

  async reorder(
    scopeGoodsIds: string[],
    orderedGoodsIds: string[],
  ): Promise<void> {
    const client = this.supabaseService.getClient();
    const now = new Date().toISOString();

    // 1. scope 안 상품의 display_order만 NULL로 초기화
    if (scopeGoodsIds.length > 0) {
      const { error: resetError } = await client
        .from('gifticon_products')
        .update({ display_order: null, updated_at: now })
        .in('smartcon_goods_id', scopeGoodsIds);
      if (resetError) throw resetError;
    }

    // 2. orderedGoodsIds 순서대로 1, 2, 3, ... 부여
    for (let i = 0; i < orderedGoodsIds.length; i++) {
      const { error } = await client
        .from('gifticon_products')
        .update({ display_order: i + 1, updated_at: now })
        .eq('smartcon_goods_id', orderedGoodsIds[i]);
      if (error) throw error;
    }
  }
}
