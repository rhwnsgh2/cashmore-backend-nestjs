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
export class SupabaseGifticonProductRepository
  implements IGifticonProductRepository
{
  private readonly logger = new Logger(SupabaseGifticonProductRepository.name);

  constructor(private supabaseService: SupabaseService) {}

  async listCatalog(eventId: string): Promise<CatalogItem[]> {
    const client = this.supabaseService.getClient();
    const { data: goods, error: goodsError } = await client
      .from('smartcon_goods')
      .select(
        'goods_id, brand_name, goods_name, msg, price, disc_price, img_url_https, cached_img_url, is_active',
      )
      .eq('event_id', eventId);
    if (goodsError) throw goodsError;

    const goodsIds = (goods ?? []).map((g) => g.goods_id);
    let products: GifticonProductRow[] = [];
    if (goodsIds.length > 0) {
      const { data, error } = await client
        .from('gifticon_products')
        .select('*')
        .in('smartcon_goods_id', goodsIds);
      if (error) throw error;
      products = (data ?? []) as unknown as GifticonProductRow[];
    }
    const productByGoodsId = new Map(
      products.map((p) => [p.smartcon_goods_id, p]),
    );

    return (goods ?? []).map((g) => {
      const p = productByGoodsId.get(g.goods_id) ?? null;
      return {
        id: p?.id ?? null,
        goods_id: g.goods_id,
        brand_name: g.brand_name ?? null,
        goods_name: g.goods_name ?? null,
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
        smartcon_goods!inner (
          goods_id,
          event_id,
          brand_name,
          goods_name,
          msg,
          img_url_https,
          cached_img_url,
          is_active
        )
      `,
      )
      .eq('is_visible', true)
      .eq('smartcon_goods.event_id', eventId)
      .eq('smartcon_goods.is_active', true)
      .order('id', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row) => {
      const g = (row as unknown as { smartcon_goods: { goods_id: string; brand_name: string | null; goods_name: string | null; msg: string | null; img_url_https: string | null; cached_img_url: string | null } }).smartcon_goods;
      return {
        id: row.id as number,
        goods_id: g.goods_id,
        brand_name: g.brand_name,
        goods_name: g.goods_name,
        msg: g.msg,
        img_url: g.cached_img_url ?? g.img_url_https ?? null,
        point_price: row.point_price as number,
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
}
